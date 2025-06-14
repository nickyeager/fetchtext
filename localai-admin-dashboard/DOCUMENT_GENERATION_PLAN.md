# UI Extension Plan: AI Document Generation

This document outlines the plan to extend the `local-ai-packaged` stack with a new user interface for generating documents from templates using AI. This UI will be built using the `shadcn-admin` project as a foundation.

## **Project Goal**

To create a new "Document Generation" feature that allows users to:
1.  Browse a gallery of document templates.
2.  Select a template.
3.  Upload a source document.
4.  Provide additional parameters.
5.  Generate a new document with data extracted from the source document by an AI model.

## **Implementation Phases**

### **Phase 1: Project Setup & Initial Integration (2 Days)**
- [x] **Clone `shadcn-admin`**: The repository has been cloned into the `localai-admin-dashboard` directory.
- [x] **Install Dependencies**: `pnpm install` has been successfully executed.
- [ ] **Create Development Branch**: A new branch `feature/document-generation` will be created.
- [ ] **Add "Documents" Page**: A new route and navigation link for the "Document Generation" feature will be added.
- [ ] **Cleanup**: Unnecessary example pages from the base `shadcn-admin` will be removed to streamline the UI.

### **Phase 2: Document Template Gallery UI (2 Days)**
- [ ] **Create `TemplateGallery` Component**: A new React component will be created to display a grid of available document templates.
- [ ] **Design `TemplateCard` Component**: A reusable card component will be designed to show a preview image and description for each template.
- [ ] **Sample Templates**: A set of sample templates (e.g., "Project Proposal," "Marketing Brief") will be created as a starting point.
- [ ] **Implement Gallery Layout**: The `TemplateGallery` will be implemented using `shadcn-ui` components like `Card` and `Grid`.

### **Phase 3: Document Transformation Workflow (3 Days)**
- [ ] **Design Transformation UI**: A new page will be designed with:
    - A file upload component for the source document.
    - A form for any additional parameters required by the template.
    - A "Generate Document" button.
- [ ] **Develop `n8n` Workflow**:
    1.  Create a new workflow in `n8n` with a webhook trigger.
    2.  Use the "Ollama" node to send the source document's content to an AI model for data extraction.
    3.  Use a "Template" or "Set" node to populate the selected document template with the extracted data.
    4.  The workflow will return the generated document as a file or text.
- [ ] **Integrate Frontend**: The "Generate Document" button will call the `n8n` webhook and handle the response.

### **Phase 4: Dockerization & Production Deployment (2 Days)**
- [ ] **Create `Dockerfile`**: A multi-stage `Dockerfile` will be created for the `localai-admin-dashboard` service.
- [ ] **Update Docker Compose**: The new service will be added to the main `docker-compose.yml`.
- [ ] **Update Caddyfile**: A new route for `admin.yourdomain.com` will be added to the `Caddyfile`.
- [ ] **End-to-End Testing**: The complete workflow will be tested in a production-like environment.

### **Phase 5: Documentation & Final Review (1 Day)**
- [ ] **User Documentation**: A guide on how to use the document generation feature.
- [ ] **Developer Documentation**: Information on the architecture and how to add new document templates.
- [ ] **Final Review**: A thorough review of the code, UI, and all documentation.

## **Verification of Feasibility**

This plan has been verified as highly feasible due to the following factors:
- **`shadcn-admin`** provides a professional and extensible UI foundation.
- **`n8n`** is ideal for orchestrating the required workflow.
- **`Ollama`** can effectively extract structured data from unstructured documents.
- The existing **Docker and Caddy infrastructure** simplifies the addition and deployment of the new UI service. 