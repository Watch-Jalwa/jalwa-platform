output "incoming_bucket" {
  value = aws_s3_bucket.incoming.bucket
}

output "processed_bucket" {
  value = aws_s3_bucket.processed.bucket
}

output "media_kms_key_arn" {
  value = aws_kms_key.media.arn
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.media.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.media.domain_name
}

output "cloudfront_key_pair_id" {
  value = aws_cloudfront_public_key.media.id
}

output "media_queue_url" {
  value = aws_sqs_queue.media_jobs.url
}

output "media_dlq_url" {
  value = aws_sqs_queue.media_dlq.url
}

output "runtime_policy_arn" {
  value = aws_iam_policy.runtime_media.arn
}

output "mediaconvert_queue_arn" {
  value = aws_media_convert_queue.alpha.arn
}

output "mediaconvert_role_arn" {
  value = aws_iam_role.mediaconvert.arn
}

output "application_callback_secret_arn" {
  value       = aws_secretsmanager_secret.application_callback.arn
  description = "Populate this secret with JSON containing the Jalwa callback URL and callback secret."
}

output "media_control_url" {
  value       = aws_lambda_function_url.control_media.function_url
  description = "Server-to-server endpoint. Every request must carry the Jalwa timestamp and HMAC headers."
}

output "media_control_secret_arn" {
  value       = aws_secretsmanager_secret.media_control.arn
  description = "Populate this secret and copy the same value into AWS_MEDIA_CONTROL_SECRET on the Jalwa web/worker host."
}
