# AWS media plane

This module is an optional media backend for Jalwa. The internal alpha can continue using the existing Cloudflare R2 and FFmpeg path while AWS is validated in staging.

It provisions:

- private KMS-encrypted incoming and processed S3 buckets;
- a separate access-log bucket;
- CloudFront with Origin Access Control;
- a CloudFront trusted key group for signed-cookie playback;
- an SQS processing queue and dead-letter queue;
- MediaConvert submission and completion Lambdas;
- an HMAC-authenticated media-control Function URL for signed uploads, object checks, job markers and emergency invalidations;
- a least-privilege runtime IAM policy;
- queue alarms and a monthly AWS budget.

## Security boundaries

- S3 public access is blocked.
- CloudFront is the only reader of processed objects.
- The CloudFront private signing key is never stored in Terraform.
- GitHub uses OIDC to assume a protected deployment role.
- The application host does not need a long-lived AWS access key in MediaConvert mode; it uses the HMAC-authenticated control endpoint.
- Staging and production use separate Terraform state, buckets, keys, queues and distributions.

## Required external bootstrap

Before the first workflow run, create:

1. an S3 Terraform-state bucket and state-lock table;
2. the GitHub OIDC provider in the AWS account;
3. separate staging and production deployment roles trusted only for the matching GitHub environment;
4. an RSA key pair for CloudFront signed cookies;
5. an ACM certificate in `us-east-1` when using a custom CloudFront domain.

Store only the public key in `AWS_MEDIA_CLOUDFRONT_PUBLIC_KEY_PEM`. Store the base64-encoded private key in the protected environment secret `AWS_MEDIA_CLOUDFRONT_PRIVATE_KEY_BASE64`.

## Runtime variables

```text
MEDIA_BACKEND=aws
AWS_REGION=ap-south-1
AWS_MEDIA_INCOMING_BUCKET=<terraform output>
AWS_MEDIA_PROCESSED_BUCKET=<terraform output>
AWS_MEDIA_CONTROL_URL=<terraform output>
AWS_MEDIA_CONTROL_SECRET=<protected secret>
AWS_MEDIA_CDN_URL=https://media-staging.example.com
CLOUDFRONT_KEY_PAIR_ID=<terraform output>
CLOUDFRONT_PRIVATE_KEY_BASE64=<protected secret>
CLOUDFRONT_COOKIE_DOMAIN=.example.com
MEDIA_PLAYBACK_TTL_SECONDS=300
```

Keep `MEDIA_BACKEND=r2` until the AWS staging acceptance has passed.


## Controlled rollout

1. Run **Apply AWS media plane** with `apply=false` against an exact main SHA.
2. Review the Terraform plan, then rerun with `apply=true` through the protected environment.
3. Deploy that exact SHA to staging.
4. Run **Set media backend** with `backend=aws`; it writes `/opt/jalwa/.env.media`, restarts web/worker transactionally and restores the prior overlay on failure.
5. Use `backend=r2` for the tested rollback path.

The custom media domain, us-east-1 ACM certificate and CloudFront signing key pair are mandatory because HLS signed cookies must share the application parent domain.
