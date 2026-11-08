# Authoring sites and operations

To turn a site into an API, capture its network traffic or write an operation manifest.

## 1. Automated Learning

Run the automated learner with an example URL template and concrete query arguments:
```bash
npx -y api-anything learn "<url-template>" --args param=val --args2 param=val2 --args3 param=val3
```

The learner drives Chrome/Edge in headless mode, intercepts outgoing XHR and Fetch network requests, extracts the dynamic endpoints, verifies schema consistency across the 3 parameter sets, and saves the verified site definition into `~/.api-anything/sites/`.

## 2. Inspecting and Calling

List registered sites and operations:
```bash
npx -y api-anything sites
npx -y api-anything ops <site-name>
```

Execute an operation over plain HTTP:
```bash
npx -y api-anything call <site-name> <operation-name> key=val
```
