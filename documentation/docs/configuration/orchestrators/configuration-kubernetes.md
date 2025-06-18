---
sidebar_position: 5
next: how-to-contribute
---

# Configuration Kubernetes

If you use Kubernetes, set `orchestrator: kubernetes`. Instantiate looks for the manifest file `.instantiate/all.yml` by default. You can change this path using the `stackfile` option.

```yaml
# .instantiate/config.yml
orchestrator: kubernetes
stackfile: all.yml

services:
  web:
    ports: 1
```

```yaml
# .instantiate/all.yml
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
