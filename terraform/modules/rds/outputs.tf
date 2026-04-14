output "cluster_endpoint"        { value = aws_rds_cluster.main.endpoint;        sensitive = true }
output "cluster_reader_endpoint" { value = aws_rds_cluster.main.reader_endpoint; sensitive = true }
output "cluster_id"              { value = aws_rds_cluster.main.cluster_identifier }
