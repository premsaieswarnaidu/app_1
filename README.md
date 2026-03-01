app_1 is a production-grade user registration application deployed on Kubernetes. 
Users can register with a name and email address via a React frontend, which calls a Node.js/Express backend API, which persists data to MongoDB. 
The deployment demonstrates Kubernetes-native security, observability, and resilience patterns.

1.1 Architecture Summary
  Frontend	React SPA + Nginx	User registration form and user list display
  Backend	Node.js + Express	REST API: register, fetch users, health probes, Prometheus metrics
  Database	MongoDB 6 (StatefulSet)	Persistent user storage with PVC-backed volume
  Ingress	NGINX Ingress Controller	TLS termination, path-based routing (/ → frontend, /api → backend)
  TLS	cert-manager (self-signed)	Certificate for myapp.local issued to NGINX Ingress only
  Security	NetworkPolicy + RBAC + PSA	Pod-to-pod traffic restricted; frontend→backend→MongoDB only

1.2 Repository Structure
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
      ├── namespace.yaml
      ├── prometheus/    # prometheus-config.yaml, alert-rules.yaml, service-monitor.yaml
      ├── grafana/       # grafana-deployment.yaml, datasource + dashboard ConfigMaps
      ├── jaeger/        # jaeger-deployment.yaml, jaeger-service.yaml
      └── efk/           # elasticsearch-deployment.yaml, fluentd-daemonset.yaml, kibana-deployment.yaml

2. Backend API Reference
  Method	Path	Response	Description
  POST	/api/register	201 JSON	Create user (name, email). Saves to MongoDB usersdb.
  GET	/api/users	200 JSON[]	Return all registered users from MongoDB.
  GET	/health	200 {"status":"OK"}	Kubernetes liveness probe endpoint.
  GET	/ready	200 {"status":"READY"}	Kubernetes readiness probe endpoint.
  GET	/metrics	200 text/plain	Prometheus metrics: http_request_duration_seconds histogram + Node.js defaults.

2.1 Environment Variables (Backend)
  Variable	Source	Value
  MONGO_USERNAME	SealedSecret → mongodb-secret	Decrypted by SealedSecrets controller
  MONGO_PASSWORD	SealedSecret → mongodb-secret	Decrypted by SealedSecrets controller
  MONGO_HOST	Deployment env literal	mongodb (headless service name)
  MONGO_DB	Deployment env literal	usersdb
  JAEGER_AGENT_HOST	Deployment env literal	localhost (sidecar in same pod)
  PORT	Default	5000

3. Security Architecture

3.1 Network Policy — Traffic Flow
  Network segmentation is enforced entirely by Kubernetes NetworkPolicy. The policy uses both Ingress and Egress rules to create a strict allow-list.

  Allowed Traffic Flows (all other traffic is DENIED)
    Internet → NGINX Ingress   : HTTPS :443 (TLS terminated at Ingress)
    ingress-nginx → frontend   : HTTP :80 (internal cluster traffic)
    frontend pods → backend    : TCP :5000 (enforced by NetworkPolicy podSelector)
    backend pods → mongodb     : TCP :27017 (enforced by NetworkPolicy podSelector)
    Prometheus → backend       : TCP :5000 scrape /metrics
    BLOCKED: Direct internet → backend   (no external service, ClusterIP only)
    BLOCKED: Direct internet → mongodb   (headless ClusterIP None)
    BLOCKED: mongodb → backend or frontend  (egress deny-all)


3.2 TLS Configuration
  TLS is applied only at the Ingress entry point. Internal cluster traffic (frontend→backend, backend→mongodb) travels over unencrypted TCP within the cluster network. 
  This is the standard Kubernetes pattern without a service mesh.

  Component	TLS	Details
    Ingress → Client	YES	cert-manager, ClusterIssuer: selfsigned-issuer, secret: frontend-tls
    Frontend → Backend	NO (NetworkPolicy)	TCP :5000, secured by NetworkPolicy podSelector
    Backend → MongoDB	NO (NetworkPolicy)	TCP :27017, secured by NetworkPolicy podSelector

3.3 Pod Security
  Control	Implementation
    Pod Security Admission	pod-security.kubernetes.io/enforce: restricted on default namespace
    Non-root user	runAsNonRoot: true, runAsUser: 1000/1000 (backend), 999/999 (mongo)
    Capability dropping	capabilities.drop: [ALL] on all containers
    Read-only filesystem	readOnlyRootFilesystem: true (frontend, backend). emptyDir volumes for nginx cache/run/tmp
    Privilege escalation	allowPrivilegeEscalation: false on all containers

3.4 RBAC Roles
  Role	Resources	Permissions
  developer-role	pods, pods/log	get, list, watch — read-only pod inspection
  operator-role	deployments, replicasets, statefulsets	get, list, watch, update, patch — manage deployments
  admin-role	* (all resources)	* (all verbs) — full cluster access

3.5 SealedSecrets
  MongoDB credentials are stored as a SealedSecret (Bitnami SealedSecrets). 
  The secret is asymmetrically encrypted using the cluster's public key. 
  The encrypted ciphertext is safe to commit to Git — only the SealedSecrets controller running in the cluster can decrypt it using its private key.

4. Observability

4.1 Three Pillars
  Pillar	Tool	Data Collected	Access
  Metrics	Prometheus + Grafana	http_request_duration_seconds, Node.js defaults, k8s pod metrics	Grafana NodePort :30232
  Logs	EFK (Elasticsearch + Fluentd + Kibana)	All pod stdout logs, Kubernetes events, Nginx access logs	Kibana UI
  Traces	Jaeger (all-in-one:1.55)	Request traces from backend via jaeger-agent sidecar (UDP :6831)	Jaeger UI :16686


