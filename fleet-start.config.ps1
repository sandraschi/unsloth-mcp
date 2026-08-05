# Per-repo fleet start config for unsloth-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard and should not be customized.
@{
    Name         = 'unsloth-mcp'
    BackendPort  = 11150
    FrontendPort = 11151
    HealthPath   = '/api/health'
    WebRoot      = 'D:\Dev\repos\unsloth-mcp\web_sota'

    Backend = @{
        Kind          = 'uvicorn-web-app'
        UvicornTarget = 'unsloth_mcp.http_app:web_app'
        Module        = 'unsloth_mcp.http_app'
        SyncExtras    = @('dev')
        Env           = @{WEB_PORT = '11150'}
    }

    Frontend = @{
        Kind           = 'vite-bun'
        PackageManager = 'bun'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
