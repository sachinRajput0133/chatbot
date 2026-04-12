output "uploads_bucket_name"   { value = aws_s3_bucket.uploads.id }
output "uploads_bucket_domain" { value = aws_s3_bucket.uploads.bucket_regional_domain_name }
output "assets_bucket_name"    { value = aws_s3_bucket.assets.id }
output "assets_bucket_domain"  { value = aws_s3_bucket.assets.bucket_regional_domain_name }
