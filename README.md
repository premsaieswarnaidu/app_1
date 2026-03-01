# app_1

Production-grade user registration application deployed on Kubernetes (Minikube cluster).

Users can register with a name and email via a React frontend, which calls a Node.js/Express backend API that persists data to MongoDB.

The deployment demonstrates Kubernetes-native security, observability, and resilience patterns.

---

## 1. Architecture Summary

| Layer       | Technology                     | Purpose |
|------------|--------------------------------|----------|
| Frontend   | React SPA + Nginx              | User registration form and user list display |
| Backend    | Node.js + Express              | REST API: register, fetch users, health probes, Prometheus metrics |
| Database   | MongoDB 6 (StatefulSet)        | Persistent user storage with PVC-backed volume |
| Ingress    | NGINX Ingress Controller       | TLS termination, path routing (/ → frontend, /api → backend) |
| TLS        | cert-manager (self-signed)     | Certificate for myapp.local |
| Security   | NetworkPolicy + RBAC + PSA     | Restricted pod-to-pod traffic |

---

## 1.2 Repository Structure

```
 app_1/
  ├── backend/
  │   ├── server.js              # Express API (register, users, health, ready, metrics)
  │   ├── tests/server.test.js   # Jest + supertest test suite
  │   ├── package.json           # Dependencies: express, mongoose, prom-client
  │   ├── .eslintrc.json         # ESLint config
  │   └── Dockerfile
  ├── frontend/
  │   ├── src/App.js             # React registration form + user list
  │   └── Dockerfile
  ├── manifests/                 # Core Kubernetes resources
  │   ├── backend-deployment.yaml     # Deployment: 2 replicas, jaeger-agent sidecar
  │   ├── frontend-deployment.yaml    # Deployment: 2 replicas, emptyDir volumes
  │   ├── mongodb-statefulset.yaml    # StatefulSet: PVC 1Gi
  │   ├── services.yaml               # frontend (NodePort:80), backend, mongodb (headless)
  │   ├── ingress.yaml                # NGINX Ingress, TLS myapp.local
  │   ├── configmap.yaml
  │   ├── hpa.yaml                    # HPA: backend 2–5 replicas @ 70% CPU
  │   ├── pdb.yaml                    # PodDisruptionBudget: minAvailable 1
  │   └── network-policy.yaml         # NetworkPolicy: frontend→backend only
  ├── security/
  │   ├── rbac.yaml                   # developer / operator / admin ClusterRoles
  │   ├── network-policy.yaml         # Full segmentation policy (Ingress + Egress)
  │   ├── pod-security.yaml           # PSA: enforce restricted on default namespace
  │   ├── cluster-issuer.yaml         # cert-manager ClusterIssuer (self-signed)
  │   ├── frontend-cert.yaml          # Certificate CR: frontend-tls secret
  │   ├── sealed-secret-mongodb.yaml  # SealedSecret: MongoDB credentials (encrypted in Git)
  │   └── cainjector-rbac.yaml
  └── observability/
  |   ├── namespace.yaml
  |   ├── prometheus/    # prometheus-config.yaml, alert-rules.yaml, service-monitor.yaml
  |   ├── grafana/       # grafana-deployment.yaml, datasource + dashboard ConfigMaps
  |   ├── jaeger/        # jaeger-deployment.yaml, jaeger-service.yaml
  |   └── efk/           # elasticsearch-deployment.yaml, fluentd-daemonset.yaml, kibana-deployment
  |
  └── .github/workflows  # ci.yaml lint testing & image scan & image build, update manifests
```

---

## 2. Backend API Reference

| Method | Path           | Response | Description |
|--------|---------------|----------|------------|
| POST   | /api/register | 201 JSON | Create user |
| GET    | /api/users    | 200 JSON[] | Fetch users |
| GET    | /health       | 200 {"status":"OK"} | Liveness probe |
| GET    | /ready        | 200 {"status":"READY"} | Readiness probe |
| GET    | /metrics      | 200 text/plain | Prometheus metrics |

---

## 3. Security Architecture

### 3.1 Network Policy

Allowed traffic:
- Internet → Ingress (HTTPS 443)
- Ingress → Frontend (80)
- Frontend → Backend (5000)
- Backend → MongoDB (27017)
- Prometheus → Backend (/metrics)

Blocked:
- Direct Internet → Backend
- Direct Internet → MongoDB
- MongoDB → Other Pods

---

### 3.2 TLS Configuration

| Component | TLS | Details |
|-----------|-----|---------|
| Ingress → Client | YES | cert-manager self-signed |
| Frontend → Backend | NO | Protected by NetworkPolicy |
| Backend → MongoDB | NO | Protected by NetworkPolicy |

---

### 3.3 Pod Security

- runAsNonRoot: true
- capabilities.drop: [ALL]
- readOnlyRootFilesystem: true
- allowPrivilegeEscalation: false

---

## 4. Observability

### Three Pillars

| Pillar | Tool | Data | Access |
|--------|------|------|--------|
| Metrics | Prometheus + Grafana | HTTP latency, pod metrics | NodePort |
| Logs | EFK Stack | Pod logs, events | Kibana UI |
| Traces | Jaeger | Backend traces | Jaeger UI |

---

## 5. CI/CD + ArgoCD

- GitHub Actions handles:
  - Linting
  - Testing
  - Image scan
  - Image build
  - Manifest updates

- ArgoCD watches `main` branch and deploys automatically to Minikube.

---
