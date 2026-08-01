locals {
  prefix = "${var.project_name}-${var.environment}-media"
}

resource "aws_kms_key" "media" {
  description             = "${local.prefix} object encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "media" {
  name          = "alias/${local.prefix}"
  target_key_id = aws_kms_key.media.key_id
}

resource "aws_s3_bucket" "incoming" {
  bucket        = "${local.prefix}-incoming"
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket" "processed" {
  bucket        = "${local.prefix}-processed"
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket" "logs" {
  bucket        = "${local.prefix}-logs"
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_public_access_block" "media" {
  for_each = {
    incoming  = aws_s3_bucket.incoming.id
    processed = aws_s3_bucket.processed.id
    logs      = aws_s3_bucket.logs.id
  }

  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "logs" {
  depends_on = [aws_s3_bucket_ownership_controls.logs]
  bucket     = aws_s3_bucket.logs.id
  acl        = "log-delivery-write"
}

resource "aws_s3_bucket_logging" "incoming" {
  bucket        = aws_s3_bucket.incoming.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access/incoming/"
  depends_on    = [aws_s3_bucket_acl.logs]
}

resource "aws_s3_bucket_logging" "processed" {
  bucket        = aws_s3_bucket.processed.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access/processed/"
  depends_on    = [aws_s3_bucket_acl.logs]
}

resource "aws_s3_bucket_versioning" "incoming" {
  bucket = aws_s3_bucket.incoming.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "processed" {
  bucket = aws_s3_bucket.processed.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "incoming" {
  bucket = aws_s3_bucket.incoming.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.media.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "processed" {
  bucket = aws_s3_bucket.processed.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.media.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "incoming" {
  count  = length(var.upload_allowed_origins) == 0 ? 0 : 1
  bucket = aws_s3_bucket.incoming.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = var.upload_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 900
  }
}

resource "aws_s3_bucket_cors_configuration" "processed" {
  bucket = aws_s3_bucket.processed.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.upload_allowed_origins
    expose_headers  = ["ETag", "Content-Length", "Content-Range"]
    max_age_seconds = 900
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "incoming" {
  bucket = aws_s3_bucket.incoming.id

  rule {
    id     = "quarantine-retention"
    status = "Enabled"
    filter {}

    expiration { days = var.environment == "staging" ? 14 : 30 }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "processed" {
  bucket = aws_s3_bucket.processed.id

  rule {
    id     = "archive-old-versions"
    status = "Enabled"
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 180
    }
  }
}

resource "aws_sqs_queue" "media_dlq" {
  name                      = "${local.prefix}-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = aws_kms_key.media.arn
}

resource "aws_sqs_queue" "media_jobs" {
  name                       = "${local.prefix}-jobs"
  visibility_timeout_seconds = 7200
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  kms_master_key_id          = aws_kms_key.media.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.media_dlq.arn
    maxReceiveCount     = 4
  })
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${local.prefix}-oac"
  description                       = "Private Jalwa processed-media origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "media" {
  name        = "${local.prefix}-cache"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}

resource "aws_cloudfront_response_headers_policy" "media" {
  name = "${local.prefix}-browser-security"

  cors_config {
    access_control_allow_credentials = true
    access_control_max_age_sec       = 900
    origin_override                  = true

    access_control_allow_headers { items = ["*"] }
    access_control_allow_methods { items = ["GET", "HEAD", "OPTIONS"] }
    access_control_allow_origins { items = var.upload_allowed_origins }
    access_control_expose_headers { items = ["ETag", "Content-Length", "Content-Range"] }
  }

  security_headers_config {
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

resource "aws_cloudfront_public_key" "media" {
  name        = "${local.prefix}-signing-key"
  encoded_key = var.cloudfront_public_key_pem
}

resource "aws_cloudfront_key_group" "media" {
  name  = "${local.prefix}-key-group"
  items = [aws_cloudfront_public_key.media.id]
}

resource "aws_cloudfront_distribution" "media" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.prefix} signed HLS and MP4"
  aliases         = [var.media_domain]
  price_class     = "PriceClass_200"
  http_version    = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.processed.bucket_regional_domain_name
    origin_id                = "processed-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  default_cache_behavior {
    target_origin_id           = "processed-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.media.id
    trusted_key_groups         = [aws_cloudfront_key_group.media.id]
    response_headers_policy_id = aws_cloudfront_response_headers_policy.media.id
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    include_cookies = false
    prefix          = "cloudfront/"
  }
}

data "aws_iam_policy_document" "processed_origin" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.processed.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "processed" {
  bucket = aws_s3_bucket.processed.id
  policy = data.aws_iam_policy_document.processed_origin.json
}

data "aws_iam_policy_document" "runtime_media" {
  statement {
    sid = "MediaObjects"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:AbortMultipartUpload",
      "s3:ListBucket",
      "s3:GetObjectAttributes"
    ]
    resources = [
      aws_s3_bucket.incoming.arn,
      "${aws_s3_bucket.incoming.arn}/*",
      aws_s3_bucket.processed.arn,
      "${aws_s3_bucket.processed.arn}/*"
    ]
  }

  statement {
    sid = "MediaQueue"
    actions = [
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ReceiveMessage",
      "sqs:SendMessage",
      "sqs:ChangeMessageVisibility"
    ]
    resources = [aws_sqs_queue.media_jobs.arn, aws_sqs_queue.media_dlq.arn]
  }

  statement {
    sid = "MediaKms"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:GenerateDataKey"
    ]
    resources = [aws_kms_key.media.arn]
  }
}

resource "aws_iam_policy" "runtime_media" {
  name   = "${local.prefix}-runtime"
  policy = data.aws_iam_policy_document.runtime_media.json
}


resource "aws_sns_topic" "media_alerts" {
  name              = "${local.prefix}-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "media_alerts_email" {
  for_each  = toset(var.budget_alert_emails)
  topic_arn = aws_sns_topic.media_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "dlq_visible" {
  alarm_name          = "${local.prefix}-dlq-visible"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Jalwa media jobs have entered the dead-letter queue."
  alarm_actions       = [aws_sns_topic.media_alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.media_dlq.name
  }
}

resource "aws_cloudwatch_metric_alarm" "queue_age" {
  alarm_name          = "${local.prefix}-queue-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1800
  alarm_description   = "Jalwa media processing queue age exceeds 30 minutes."
  alarm_actions       = [aws_sns_topic.media_alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.media_jobs.name
  }
}

resource "aws_budgets_budget" "media" {
  name         = "${local.prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = length(var.budget_alert_emails) == 0 ? [] : [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value == 100 ? "FORECASTED" : "ACTUAL"
      subscriber_email_addresses = var.budget_alert_emails
    }
  }
}

resource "aws_media_convert_queue" "alpha" {
  name            = "${local.prefix}-transcode"
  description     = "Jalwa internal-alpha VOD transcoding"
  pricing_plan    = "ON_DEMAND"
  status          = "ACTIVE"
  concurrent_jobs = 2
}

data "aws_iam_policy_document" "mediaconvert_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["mediaconvert.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "mediaconvert" {
  name               = "${local.prefix}-mediaconvert"
  assume_role_policy = data.aws_iam_policy_document.mediaconvert_assume.json
}

data "aws_iam_policy_document" "mediaconvert" {
  statement {
    sid       = "ReadIncoming"
    actions   = ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket"]
    resources = [aws_s3_bucket.incoming.arn, "${aws_s3_bucket.incoming.arn}/*"]
  }
  statement {
    sid = "WriteProcessed"
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload",
      "s3:ListBucket"
    ]
    resources = [aws_s3_bucket.processed.arn, "${aws_s3_bucket.processed.arn}/*"]
  }
  statement {
    sid       = "UseMediaKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.media.arn]
  }
}

resource "aws_iam_role_policy" "mediaconvert" {
  role   = aws_iam_role.mediaconvert.id
  policy = data.aws_iam_policy_document.mediaconvert.json
}

resource "aws_secretsmanager_secret" "supabase" {
  name                    = "${local.prefix}/supabase-service-role"
  description             = "Populate with JSON containing url and serviceRoleKey for MediaConvert callbacks."
  recovery_window_in_days = var.environment == "staging" ? 0 : 30
  kms_key_id              = aws_kms_key.media.arn
}

data "archive_file" "submit_mediaconvert" {
  type        = "zip"
  source_file = "${path.module}/lambda/submit-mediaconvert.mjs"
  output_path = "${path.module}/submit-mediaconvert.zip"
}

data "archive_file" "complete_mediaconvert" {
  type        = "zip"
  source_file = "${path.module}/lambda/complete-mediaconvert.mjs"
  output_path = "${path.module}/complete-mediaconvert.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "media_lambda" {
  name               = "${local.prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "media_lambda" {
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${local.prefix}-*:*"]
  }
  statement {
    sid = "MediaControlObjects"
    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "${aws_s3_bucket.incoming.arn}/incoming/*",
      "${aws_s3_bucket.incoming.arn}/jobs/*",
      "${aws_s3_bucket.processed.arn}/processed/*"
    ]
  }
  statement {
    sid = "ConsumeQueue"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility"
    ]
    resources = [aws_sqs_queue.media_jobs.arn]
  }
  statement {
    sid       = "SubmitMediaConvert"
    actions   = ["mediaconvert:CreateJob"]
    resources = [aws_media_convert_queue.alpha.arn]
  }
  statement {
    sid       = "PassMediaConvertRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.mediaconvert.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["mediaconvert.amazonaws.com"]
    }
  }
  statement {
    sid       = "InvalidateMedia"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.media.arn]
  }
  statement {
    sid       = "ReadCallbackSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.supabase.arn, aws_secretsmanager_secret.media_control.arn]
  }
  statement {
    sid       = "UseMediaKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.media.arn]
  }
}

resource "aws_iam_role_policy" "media_lambda" {
  role   = aws_iam_role.media_lambda.id
  policy = data.aws_iam_policy_document.media_lambda.json
}

resource "aws_cloudwatch_log_group" "submit_mediaconvert" {
  name              = "/aws/lambda/${local.prefix}-submit-mediaconvert"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "complete_mediaconvert" {
  name              = "/aws/lambda/${local.prefix}-complete-mediaconvert"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "submit_mediaconvert" {
  function_name    = "${local.prefix}-submit-mediaconvert"
  role             = aws_iam_role.media_lambda.arn
  handler          = "submit-mediaconvert.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.submit_mediaconvert.output_path
  source_code_hash = data.archive_file.submit_mediaconvert.output_base64sha256
  timeout          = 60
  memory_size      = 512

  environment {
    variables = {
      INCOMING_BUCKET        = aws_s3_bucket.incoming.bucket
      PROCESSED_BUCKET       = aws_s3_bucket.processed.bucket
      MEDIACONVERT_QUEUE_ARN = aws_media_convert_queue.alpha.arn
      MEDIACONVERT_ROLE_ARN  = aws_iam_role.mediaconvert.arn
      SUPABASE_SECRET_ARN    = aws_secretsmanager_secret.supabase.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.submit_mediaconvert]
}

resource "aws_lambda_function" "complete_mediaconvert" {
  function_name    = "${local.prefix}-complete-mediaconvert"
  role             = aws_iam_role.media_lambda.arn
  handler          = "complete-mediaconvert.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.complete_mediaconvert.output_path
  source_code_hash = data.archive_file.complete_mediaconvert.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      SUPABASE_SECRET_ARN = aws_secretsmanager_secret.supabase.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.complete_mediaconvert]
}

resource "aws_secretsmanager_secret" "media_control" {
  name                    = "${local.prefix}/control-secret"
  description             = "Populate with a 32+ character raw secret or JSON containing a secret field."
  recovery_window_in_days = var.environment == "staging" ? 0 : 30
  kms_key_id              = aws_kms_key.media.arn
}

data "archive_file" "control_media" {
  type        = "zip"
  source_file = "${path.module}/lambda/control-media.mjs"
  output_path = "${path.module}/control-media.zip"
}

resource "aws_cloudwatch_log_group" "control_media" {
  name              = "/aws/lambda/${local.prefix}-control-media"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "control_media" {
  function_name                  = "${local.prefix}-control-media"
  reserved_concurrent_executions = 10
  role                           = aws_iam_role.media_lambda.arn
  handler                        = "control-media.handler"
  runtime                        = "nodejs22.x"
  filename                       = data.archive_file.control_media.output_path
  source_code_hash               = data.archive_file.control_media.output_base64sha256
  timeout                        = 30
  memory_size                    = 256

  environment {
    variables = {
      INCOMING_BUCKET    = aws_s3_bucket.incoming.bucket
      PROCESSED_BUCKET   = aws_s3_bucket.processed.bucket
      KMS_KEY_ARN        = aws_kms_key.media.arn
      CONTROL_SECRET_ARN = aws_secretsmanager_secret.media_control.arn
      MAX_UPLOAD_BYTES   = "10737418240"
      DISTRIBUTION_ID    = aws_cloudfront_distribution.media.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.control_media]
}

resource "aws_lambda_function_url" "control_media" {
  function_name      = aws_lambda_function.control_media.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "control_media_url" {
  statement_id           = "AllowPublicFunctionUrlWithApplicationHmac"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.control_media.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "control_media_invoke" {
  statement_id             = "AllowInvokeViaFunctionUrlOnly"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.control_media.function_name
  principal                = "*"
  invoked_via_function_url = true
}

data "aws_iam_policy_document" "media_queue" {
  statement {
    sid       = "AllowIncomingBucketNotifications"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.media_jobs.arn]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.incoming.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_sqs_queue_policy" "media_jobs" {
  queue_url = aws_sqs_queue.media_jobs.id
  policy    = data.aws_iam_policy_document.media_queue.json
}

resource "aws_s3_bucket_notification" "media_jobs" {
  bucket = aws_s3_bucket.incoming.id

  queue {
    queue_arn     = aws_sqs_queue.media_jobs.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "jobs/"
    filter_suffix = ".json"
  }

  depends_on = [aws_sqs_queue_policy.media_jobs]
}

resource "aws_lambda_event_source_mapping" "media_jobs" {
  event_source_arn                   = aws_sqs_queue.media_jobs.arn
  function_name                      = aws_lambda_function.submit_mediaconvert.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0
  function_response_types            = ["ReportBatchItemFailures"]
}

resource "aws_cloudwatch_event_rule" "mediaconvert_status" {
  name        = "${local.prefix}-mediaconvert-status"
  description = "Complete or fail Jalwa database media jobs from MediaConvert status."
  event_pattern = jsonencode({
    source        = ["aws.mediaconvert"]
    "detail-type" = ["MediaConvert Job State Change"]
    detail = {
      status = ["COMPLETE", "ERROR"]
      queue  = [aws_media_convert_queue.alpha.arn]
    }
  })
}

resource "aws_cloudwatch_event_target" "mediaconvert_complete" {
  rule      = aws_cloudwatch_event_rule.mediaconvert_status.name
  target_id = "complete-media-job"
  arn       = aws_lambda_function.complete_mediaconvert.arn
}

resource "aws_lambda_permission" "eventbridge_complete" {
  statement_id  = "AllowEventBridgeMediaConvert"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.complete_mediaconvert.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.mediaconvert_status.arn
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = {
    control  = aws_lambda_function.control_media.function_name
    submit   = aws_lambda_function.submit_mediaconvert.function_name
    complete = aws_lambda_function.complete_mediaconvert.function_name
  }

  alarm_name          = "${local.prefix}-${each.key}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.media_alerts.arn]

  dimensions = {
    FunctionName = each.value
  }
}

data "aws_iam_policy_document" "media_kms" {
  statement {
    sid       = "EnableAccountPermissions"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  statement {
    sid       = "AllowS3QueueNotifications"
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media.arn]
    }
  }
}

resource "aws_kms_key_policy" "media" {
  key_id = aws_kms_key.media.id
  policy = data.aws_iam_policy_document.media_kms.json
}
