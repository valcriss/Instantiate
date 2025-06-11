---
sidebar_position: 4
---

# Configuration Kubernetes

If you use Kubernetes, set `orchestrator: kubernetes` and place your manifests in `.instantiate/docker-compose.yml`.

```yaml
# .instantiate/config.yml
orchestrator: kubernetes
expose_ports:
  - service: web
    port: 80
    name: WEB_PORT
```

```yaml
# .instantiate/docker-compose.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  type: NodePort
  ports:
    - port: 80
      nodePort: {{WEB_PORT}}
```
