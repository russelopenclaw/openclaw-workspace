#!/bin/bash

# ============================================================================
# Automated Deployment Script with Pipeline Integration
# ============================================================================
#
# Usage:
#   ./deploy.sh [options] [environment]
#
# Options:
#   -p, --phase [pre|post|full|rollback]  Pipeline phase (default: full)
#   -e, --environment [dev|staging|prod]  Target environment (default: staging)
#   -r, --report-format [console|json|html] Report format (default: console)
#   -v, --verbose                         Verbose output
#   -n, --dry-run                         Dry run (no changes)
#   --rollback-version [version]          Version to rollback to
#   -h, --help                            Show help
#
# Examples:
#   ./deploy.sh                           # Full deployment to staging
#   ./deploy.sh prod                      # Full deployment to production
#   ./deploy.sh --phase pre               # Pre-deployment checks only
#   ./deploy.sh --phase rollback          # Rollback to last good state
#   ./deploy.sh -n -e prod                # Dry run on production
#
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PHASE="full"
ENVIRONMENT="staging"
REPORT_FORMAT="console"
VERBOSE=""
DRY_RUN=""
ROLLBACK_VERSION=""
WORKSPACE_DIR="/home/kevin/.openclaw/workspace"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Help message
show_help() {
    cat << EOF
Automated Deployment Script with Pipeline Integration

Usage: $0 [options] [environment]

Options:
  -p, --phase [pre|post|full|rollback]  Which pipeline phase to run
                                        (default: full)
  -e, --environment [dev|staging|prod]  Target environment
                                        (default: staging)
  -r, --report-format [console|json|html] Output format (default: console)
  -v, --verbose                         Show detailed output
  -n, --dry-run                         Run without making changes
  --rollback-version [version]          Git tag to rollback to
  -h, --help                            Show this help message

Environment Variables:
  DEPLOY_TARGET                         Override deployment target
  SKIP_PIPELINE                         Skip pipeline checks (true/false)
  DEPLOY_BRANCH                         Branch to deploy (default: current)

Examples:
  $0                                    # Full deployment to staging
  $0 prod                               # Full deployment to production
  $0 --phase pre -e staging             # Pre-deployment checks only
  $0 --phase rollback                   # Rollback to last backup
  $0 -n -e prod                         # Dry run on production
  $0 --rollback-version v1.2.3          # Rollback to specific version
  $0 --verbose --report-format html     # Verbose with HTML report

Exit Codes:
  0 - Deployment successful
  1 - Deployment failed (manual intervention required)
  2 - Pre-deployment checks failed
  3 - Post-deployment smoke tests failed

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--phase)
            PHASE="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--report-format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -n|--dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --rollback-version)
            ROLLBACK_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        dev|staging|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate phase
if [[ ! "$PHASE" =~ ^(pre|post|full|rollback)$ ]]; then
    log_error "Invalid phase: $PHASE (must be pre, post, full, or rollback)"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT (must be dev, staging, or prod)"
    exit 1
fi

# Validate report format
if [[ ! "$REPORT_FORMAT" =~ ^(console|json|html)$ ]]; then
    log_error "Invalid report format: $REPORT_FORMAT (must be console, json, or html)"
    exit 1
fi

# Header
echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}🚀 Alfred Deployment Script${NC}"
echo -e "${blue}============================================================================${NC}"
echo -e "Phase:       ${YELLOW}$PHASE${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Report:      ${YELLOW}$REPORT_FORMAT${NC}"
echo -e "Dry Run:     ${YELLOW}${DRY_RUN:-false}${NC}"
echo -e "Time:        ${YELLOW}$(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Change to workspace directory
cd "$WORKSPACE_DIR" || exit 1

# Check if git repository
if [ ! -d ".git" ]; then
    log_error "Not a git repository: $WORKSPACE_DIR"
    exit 1
fi

# Get current git info
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_COMMIT=$(git rev-parse --short HEAD)

log_info "Git branch: $GIT_BRANCH ($GIT_COMMIT)"

# Function to run deployment pipeline
run_pipeline() {
    local phase=$1
    local extra_args=""
    
    [ -n "$VERBOSE" ] && extra_args="$extra_args $VERBOSE"
    [ -n "$DRY_RUN" ] && extra_args="$extra_args $DRY_RUN"
    
    if [ "$phase" = "rollback" ] && [ -n "$ROLLBACK_VERSION" ]; then
        extra_args="$extra_args --rollback-version $ROLLBACK_VERSION"
    fi
    
    log_info "Running deployment pipeline phase: $phase"
    echo ""
    
    if ! node tools/deployment-pipeline.js --phase "$phase" --environment "$ENVIRONMENT" --report-format "$REPORT_FORMAT" $extra_args; then
        return $?
    fi
    
    return 0
}

# Function to deploy
do_deploy() {
    log_info "Starting deployment..."
    echo ""
    
    # Pull latest code
    log_info "Pulling latest code..."
    if [ -z "$DRY_RUN" ]; then
        git pull origin "$GIT_BRANCH" || {
            log_warn "Git pull failed (may be on detached HEAD)"
        }
    else
        log_info "[DRY RUN] Would pull latest code"
    fi
    
    # Install dependencies
    log_info "Installing dependencies..."
    if [ -z "$DRY_RUN" ]; then
        npm ci || npm install
    else
        log_info "[DRY RUN] Would install dependencies"
    fi
    
    # Run migrations
    log_info "Running database migrations..."
    if [ -z "$DRY_RUN" ]; then
        node tools/migrations/run-all.js || {
            log_warn "Migrations failed or not needed"
        }
    else
        log_info "[DRY RUN] Would run migrations"
    fi
    
    # Build Mission Control
    if [ -d "mission-control" ]; then
        log_info "Building Mission Control..."
        if [ -z "$DRY_RUN" ]; then
            cd mission-control
            npm ci || npm install
            npm run build || {
                log_warn "Build failed"
            }
            cd ..
        else
            log_info "[DRY RUN] Would build Mission Control"
        fi
    fi
    
    # Restart services
    log_info "Restarting services..."
    if [ -z "$DRY_RUN" ]; then
        systemctl --user restart alfred-hub || {
            log_warn "Failed to restart alfred-hub via systemctl"
            log_info "Trying alternative restart methods..."
            
            # Try direct restart
            if [ -f "tools/start-alfred.js" ]; then
                # Stop any running instance
                pkill -f "node.*start-alfred" 2>/dev/null || true
                sleep 1
                # Start new instance (backgrounded)
                nohup node tools/start-alfred.js > /dev/null 2>&1 &
                log_info "Started alfred-hub directly"
            fi
        }
        sleep 3
    else
        log_info "[DRY RUN] Would restart services"
    fi
    
    log_success "Deployment completed"
    echo ""
    
    return 0
}

# Main deployment flow
main() {
    local exit_code=0
    
    case "$PHASE" in
        pre)
            log_info "Running PRE-DEPLOYMENT CHECKS"
            echo ""
            if run_pipeline "pre"; then
                log_success "✅ Pre-deployment checks passed"
                echo ""
                log_info "Ready to deploy. Run: $0 --phase full -e $ENVIRONMENT"
            else
                log_error "❌ Pre-deployment checks failed"
                exit_code=2
            fi
            ;;
            
        post)
            log_info "Running POST-DEPLOYMENT SMOKE TESTS"
            echo ""
            if run_pipeline "post"; then
                log_success "✅ Smoke tests passed - deployment verified"
            else
                log_error "❌ Smoke tests failed - consider rollback"
                log_info "To rollback: $0 --phase rollback -e $ENVIRONMENT"
                exit_code=3
            fi
            ;;
            
        rollback)
            log_warn "⚠️  INITIATING ROLLBACK"
            echo ""
            log_info "Rolling back deployment..."
            if run_pipeline "rollback"; then
                log_success "✅ Rollback completed successfully"
            else
                log_error "❌ Rollback failed - manual intervention required"
                exit_code=1
            fi
            ;;
            
        full)
            log_info "Running FULL DEPLOYMENT PIPELINE"
            echo ""
            
            # Pre-deployment checks
            log_info "Step 1: Pre-deployment checks"
            if ! run_pipeline "pre"; then
                log_error "❌ Pre-deployment checks failed"
                exit_code=2
                exit $exit_code
            fi
            
            # Deploy
            log_info "Step 2: Deploying application"
            if ! do_deploy; then
                log_error "❌ Deployment failed"
                log_info "Initiating automatic rollback..."
                run_pipeline "rollback"
                exit_code=1
                exit $exit_code
            fi
            
            # Post-deployment smoke tests
            log_info "Step 3: Post-deployment smoke tests"
            if ! run_pipeline "post"; then
                log_error "❌ Smoke tests failed"
                log_info "Initiating automatic rollback..."
                run_pipeline "rollback"
                exit_code=3
                exit $exit_code
            fi
            
            # Success!
            echo ""
            log_success "================================================================"
            log_success "🎉 DEPLOYMENT SUCCESSFUL!"
            log_success "================================================================"
            echo ""
            log_info "Environment: $ENVIRONMENT"
            log_info "Branch:      $GIT_BRANCH"
            log_info "Commit:      $GIT_COMMIT"
            log_info "Time:        $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
            echo ""
            log_info "Gateway:     http://localhost:18789"
            log_info "Dashboard:   http://localhost:8765"
            log_info "Reports:     .learnings/deployment-reports/"
            echo ""
            ;;
    esac
    
    exit $exit_code
}

# Run main
main "$@"
