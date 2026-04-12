output "task_execution_role_arn"    { value = aws_iam_role.task_execution.arn }
output "task_role_arn"              { value = aws_iam_role.task.arn }
output "ec2_instance_profile_name"  { value = aws_iam_instance_profile.ec2.name }
