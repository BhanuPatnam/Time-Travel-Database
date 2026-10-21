# Cloud Deployment Guide: Time Travel Database System

This guide outlines how to deploy the **Time Travel Database System** (Oracle Database 21c XE, FastAPI Backend, and React Developer Console) to any Cloud Virtual Private Server (VPS) / Virtual Machine (AWS EC2, DigitalOcean, Hetzner, GCP Compute Engine, or Azure VM) using Docker Compose.

---

## 1. System Requirements & Cloud Sizing

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS or 24.04 LTS (x86_64) | Ubuntu 22.04 LTS (x86_64) |
| **CPU** | 2 vCPUs | 2 to 4 vCPUs |
| **RAM** | 4 GB RAM (+ 4 GB Swap) | 8 GB RAM |
| **Disk Storage** | 25 GB SSD / NVMe | 40+ GB SSD |
| **Virtualization** | Dedicated KVM / Hardware Virtualization | Standard Cloud Compute |

### Recommended Provider Plans (~$7 - $20 / month):
- **Hetzner Cloud:** `CPX21` (3 vCPUs, 4 GB RAM, 80 GB SSD) ~ €7.00/mo *(Best value)*
- **DigitalOcean:** Basic Droplet (2 vCPUs, 4 GB RAM, 80 GB SSD) ~ $24/mo (or 2GB RAM + 4GB swap on $12/mo)
- **AWS EC2:** `t3.medium` or `t3a.medium` (2 vCPUs, 4 GB RAM)
- **AWS Lightsail:** $20/mo plan (2 vCPUs, 4 GB RAM, 80 GB SSD)

---

## 2. Inbound Security Group / Firewall Rules

Ensure the following inbound ports are open in your Cloud Provider's Firewall / Security Group:

| Port | Protocol | Purpose | Access |
| :--- | :--- | :--- | :--- |
| `22` | TCP | SSH Server Access | Your IP only (or 0.0.0.0/0 with key) |
| `80` | TCP | HTTP Web Console (Frontend) | `0.0.0.0/0` (Public) |
| `443` | TCP | HTTPS Web Console (SSL) | `0.0.0.0/0` (Public) |
| `8000` | TCP | FastAPI Swagger Docs (Optional) | `0.0.0.0/0` |
| `1521` | TCP | Oracle SQL Developer / SQL*Plus | Your IP or Admin IP only (Recommended) |

---

## 3. Step-by-Step Server Setup

### Step 1: Connect to your Server & Update Packages
SSH into your cloud server:
```bash
ssh ubuntu@YOUR_SERVER_IP
```

Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Configure 4 GB Swap Space (Essential for Oracle XE)
Oracle Database 21c XE requires dedicated swap memory for memory management:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Step 3: Install Docker and Docker Compose
Install the official Docker Engine and Compose plugin:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```
Apply group permissions without logging out:
```bash
newgrp docker
docker --version && docker compose version
```

---

## 4. Deploying the Application

### Step 1: Clone the GitHub Repository
```bash
git clone https://github.com/BhanuPatnam/Time-Travel-Database.git
cd Time-Travel-Database
```

### Step 2: Create Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
*(Default passwords and connection strings are pre-configured to work with the Docker internal network).*

### Step 3: Launch the 3-Tier Stack in Background
Run Docker Compose with automatic build:
```bash
docker compose up --build -d
```

### What Happens Automatically:
1. **Oracle 21c XE Container (`timetravel-oracle-21c`):**
   - Downloads `gvenzl/oracle-xe:21-slim`.
   - Initializes pluggable database `XEPDB1`.
   - Automatically executes `scripts/docker_init_oracle.sh`, running `database/run_all.sql` to install all 12 tables, triggers, sequences, and the 6 PL/SQL packages.
   - Populates initial business seed data.
2. **FastAPI Backend Container (`timetravel-backend`):**
   - Builds Python 3.11 image and installs `python-oracledb`.
   - Waits for Oracle container health check to pass.
   - Starts API server on port 8000.
3. **React Vite Frontend Container (`timetravel-frontend`):**
   - Compiles production React bundle.
   - Deploys static build to Alpine Nginx.
   - Proxies `/api/` traffic directly to the backend.
   - Exposes web interface on Port 80 and Port 3000.

---

## 5. Verifying the Deployment

### Check Container Status:
```bash
docker compose ps
```
You should see all 3 containers with state `Up (healthy)`.

### View Real-Time Startup Logs:
```bash
# View all services
docker compose logs -f

# View Oracle DB initialization specifically
docker compose logs -f oracle-db
```

### Test Backend Health via cURL:
```bash
curl http://localhost:8000/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "database_connected": true,
  "database_type": "Oracle Database 21c XE",
  "oracle_dsn": "oracle-db:1521/XEPDB1",
  "version": "1.0.0"
}
```

### Accessing in Your Web Browser:
Open your browser and navigate to:
```text
http://YOUR_SERVER_IP
```
- **Frontend Console:** `http://YOUR_SERVER_IP`
- **Interactive Swagger API Docs:** `http://YOUR_SERVER_IP:8000/docs`
- **Oracle SQL Port:** `YOUR_SERVER_IP:1521/XEPDB1` (User: `tt_admin`, Password: `tt_secret_123`)

---

## 6. Running SQL Demos and Benchmarks on the Cloud Server

You can execute the standalone SQL scripts directly inside the live Oracle XE container from the terminal:

### 1. Execute 12-Step Standalone SQL Demo:
```bash
docker compose exec oracle-db bash -c "cd /tmp/database && sqlplus -s tt_admin/tt_secret_123@localhost:1521/XEPDB1 @13_run_demo.sql"
```

### 2. Execute Pure PL/SQL Performance Benchmark Suite:
```bash
docker compose exec oracle-db bash -c "cd /tmp/database && sqlplus -s tt_admin/tt_secret_123@localhost:1521/XEPDB1 @14_run_benchmarks.sql"
```

---

## 7. Optional: Setting up Domain Name & Free HTTPS (SSL)

To point a custom domain (e.g. `timetravel.yourdomain.com`) with a free Let's Encrypt SSL certificate:

### 1. Point DNS A-Record
In your domain registrar (GoDaddy, Cloudflare, Namecheap), add an **A Record**:
- **Name:** `timetravel` (or `@`)
- **IPv4 Address:** `YOUR_SERVER_IP`

### 2. Install Certbot on Host
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 3. Add Host Nginx Reverse Proxy
Install Nginx on the host Ubuntu machine:
```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/timetravel`:
```nginx
server {
    server_name timetravel.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/timetravel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Issue Free SSL Certificate
```bash
sudo certbot --nginx -d timetravel.yourdomain.com
```
Certbot will configure SSL renewal automatically.

---

## 8. Operational Maintenance Cheat Sheet

| Task | Command |
| :--- | :--- |
| **Stop all services** | `docker compose down` |
| **Restart services** | `docker compose restart` |
| **Pull code updates & rebuild** | `git pull && docker compose up --build -d` |
| **View Backend logs** | `docker compose logs -f backend` |
| **View Database logs** | `docker compose logs -f oracle-db` |
| **Connect via SQL\*Plus CLI** | `docker compose exec oracle-db sqlplus tt_admin/tt_secret_123@localhost:1521/XEPDB1` |
| **Clean reinstall from scratch** | `docker compose down -v && docker compose up --build -d` |
