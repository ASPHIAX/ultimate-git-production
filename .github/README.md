# CI/CD Pipeline Configuration

This directory contains GitHub Actions workflows for automated CI/CD pipeline.

## Workflows

- `ci-build-test.yml` - Main CI pipeline with testing and security scanning
- `deploy-production.yml` - Production deployment workflow
- `security-scan.yml` - Weekly security audits and compliance checks

## Usage

All workflows are automatically triggered based on repository events:
- Push to main/develop branches triggers CI pipeline
- Weekly security scans run on Monday at 2 AM
- Production deployment available via manual trigger or releases