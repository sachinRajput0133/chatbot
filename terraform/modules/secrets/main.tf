resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.environment}/chatbot/app"
  description             = "All application environment variables"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.secret_values)
}
