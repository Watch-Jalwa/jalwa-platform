variable "project_name" {
  description = "Resource-name prefix."
  type        = string
  default     = "jalwa"
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "aws_region" {
  description = "AWS region for media storage and queues."
  type        = string
}

variable "media_domain" {
  description = "Required CloudFront custom domain under the same registrable domain as the Jalwa application."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9.-]+$", var.media_domain)) && length(var.media_domain) > 3
    error_message = "media_domain must be a valid non-empty hostname."
  }
}

variable "acm_certificate_arn" {
  description = "Required ACM certificate in us-east-1 for the CloudFront custom domain."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be a CloudFront-compatible ACM certificate in us-east-1."
  }
}

variable "cloudfront_public_key_pem" {
  description = "Required public key paired with the application-held CloudFront signing private key."
  type        = string
  sensitive   = true

  validation {
    condition     = strcontains(var.cloudfront_public_key_pem, "BEGIN PUBLIC KEY")
    error_message = "cloudfront_public_key_pem must contain a PEM public key."
  }
}

variable "budget_limit_usd" {
  description = "Monthly AWS media budget."
  type        = number
  default     = 100
}

variable "budget_alert_emails" {
  description = "Addresses notified at 50, 80 and 100 percent of the monthly budget."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 30
}

variable "force_destroy" {
  description = "Allow bucket deletion with objects. Keep false outside disposable staging."
  type        = bool
  default     = false
}

variable "upload_allowed_origins" {
  description = "Exact Jalwa browser origins allowed to upload and fetch credentialed media."
  type        = list(string)

  validation {
    condition     = length(var.upload_allowed_origins) > 0 && alltrue([for origin in var.upload_allowed_origins : startswith(origin, "https://")])
    error_message = "upload_allowed_origins must include at least one HTTPS application origin."
  }
}
