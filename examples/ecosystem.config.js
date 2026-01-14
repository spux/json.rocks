// PM2 ecosystem configuration file for json.rocks
//
// Usage:
//   Production: pm2 start ecosystem.config.js --env production
//   Development: pm2 start ecosystem.config.js --env development
//
// See: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [{
    name: 'json-rocks',
    script: './bin/server.js',
    instances: 1,
    exec_mode: 'fork',

    // Production environment
    env_production: {
      NODE_ENV: 'production',
      ADMIN_USER: 'admin',
      ADMIN_PASS: process.env.ADMIN_PASS, // Set in shell: export ADMIN_PASS=password
      AUTH_MODE: 'optional' // open, optional, or required
    },

    // Development environment
    env_development: {
      NODE_ENV: 'development',
      ADMIN_USER: 'admin',
      ADMIN_PASS: 'dev-password-change-me',
      AUTH_MODE: 'open'
    },

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Performance
    max_memory_restart: '500M',
    instances: 1, // Increase for clustering

    // Restart behavior
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,

    // Disable watch in production
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],

    // Cron restart (optional - restart daily at 2 AM)
    // cron_restart: '0 2 * * *',

    // Source map support
    source_map_support: true,

    // Instance variables (available in app)
    instance_var: 'INSTANCE_ID'
  }]
}
