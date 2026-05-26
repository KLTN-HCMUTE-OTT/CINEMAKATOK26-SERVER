const fs = require('fs');
const path = require('path');

function processEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Normalize ports (change 5432 to 5433)
  content = content.replace(/([A-Z_]+_DB_PORT)=5432/g, '$1=5433');

  // Normalize database names
  content = content.replace(/auth-service-db/g, 'auth_service_db');
  content = content.replace(/user-service-db/g, 'user_service_db');
  content = content.replace(/user-activity-service-db/g, 'user_activity_db');
  content = content.replace(/audit-log-service-db/g, 'audit_log_db');
  content = content.replace(/audit-log-db/g, 'audit_log_db');
  content = content.replace(/content-service-db/g, 'content_service_db');
  content = content.replace(/streaming-service-db/g, 'streaming_service_db');
  content = content.replace(/payment-service-db/g, 'payment_service_db');
  content = content.replace(/order-service-db/g, 'order_service_db');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${filePath}`);
}

const rootDir = path.resolve(__dirname, '..');
const appsDir = path.join(rootDir, 'apps');

if (fs.existsSync(appsDir)) {
  fs.readdirSync(appsDir).forEach(app => {
    const envPath = path.join(appsDir, app, '.env');
    processEnvFile(envPath);
  });
}
