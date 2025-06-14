# Git & Docker Strategy for UI Extension

This document outlines the strategy for managing the source code and containerization of the new `localai-admin-dashboard` user interface.

## **1. Git Strategy: Monorepo Approach**

To maintain simplicity and ensure the UI extension is bundled with the main project, we will use a monorepo approach.

### **Rationale:**

-   **Simplicity**: Everything is contained in a single repository. A single `git clone` is all that's needed to get the entire project, including the new UI.
-   **Cohesion**: The UI is a core part of the extended stack, so it makes sense to version it alongside the backend services it interacts with.
-   **Ease of Development**: Docker Compose can easily reference the UI's subdirectory for building the container image.

### **Implementation Steps:**

1.  **Remove Nested Git History**: The cloned `shadcn-admin` project contains its own `.git` directory. This will be removed to prevent a nested repository (submodule) and allow the code to be absorbed into the main project's history.
2.  **Add to Main Project**: The entire `localai-admin-dashboard` directory will be staged and committed to the `local-ai-packaged` repository.
3.  **Feature Branching**: All development for the new UI will be done on a dedicated feature branch (e.g., `feature/document-generation-ui`) to ensure the `main` branch remains stable.

## **2. Docker Strategy: Dedicated Docker Image**

The `localai-admin-dashboard` will be containerized as its own service, consistent with the microservice architecture of the existing stack.

### **Rationale:**

-   **Isolation**: The UI will run in its own container, separate from other services, which is a best practice for stability and security.
-   **Scalability**: While not a primary concern now, this approach allows the UI to be scaled independently if needed.
-   **Consistency**: It follows the same pattern as all other services (`n8n`, `open-webui`, etc.) in the `docker-compose.yml` file.

### **Implementation Steps:**

1.  **Create a `Dockerfile`**: A `Dockerfile` will be placed in the `localai-admin-dashboard` root directory.
2.  **Use a Multi-Stage Build**:
    -   **`build` Stage**: A `node` image will be used to install dependencies with `pnpm` and build the static assets (`pnpm run build`).
    -   **`production` Stage**: The compiled static files (HTML, CSS, JS) from the `build` stage will be copied into a lightweight and secure `nginx:alpine` image for serving. This results in a small, optimized final image.
3.  **Update `docker-compose.yml`**: A new service will be added:

    ```yaml
    services:
      # ... existing services ...

      localai-admin-dashboard:
        build: 
          context: ./localai-admin-dashboard
          dockerfile: Dockerfile
        container_name: localai-admin-dashboard
        restart: unless-stopped
        expose:
          - 3000 # Internal port for the Nginx server
    ```
4.  **Update `Caddyfile`**: To expose the new UI to the outside world, a new entry will be added to the `Caddyfile`, routing a subdomain to the new service.

    ```caddy
    admin.yourdomain.com {
        reverse_proxy localai-admin-dashboard:3000
    }
    ```

This Git and Docker strategy provides a clean, manageable, and scalable foundation for developing and deploying the new UI extension. 