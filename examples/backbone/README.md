# Backbone Stack

**Demo infrastructure stack with Terraform provisioning**

Backbone demonstrates Universal data modeling with a complete infrastructure setup including:
- 4 LXC containers (DNS, reverse proxy, 2 web servers)
- Proxmox hypervisor node
- Network router
- Service definitions
- Terraform provisioning with aspect defaults

## What's Included

**Infrastructure (6 instances):**
- `hypervisor01` - Proxmox VE node
- `router` - Network gateway/router
- `backbone_dns` - DNS server container (LXC)
- `backbone_proxy` - Reverse proxy container (LXC)
- `backbone_web01` - Web server container (LXC)
- `backbone_web02` - Web server container (LXC)

**Services (3 instances):**
- `backbone_web01_svc` - Web service definition
- `backbone_web02_svc` - Network service definition

**Output Formats:**
- Interactive HTML viewer
- Terraform configuration (via terraform mixin)
- Ansible playbooks (via ansible mixin)

## Quick Start

### Build the Stack

```bash
cd public/struktur/examples/backbone
struktur build . --build-dir build
```

This generates:
- `build/build-{hash}/index.html` - Interactive viewer
- `build/build-{hash}/canonical.json` - Full data model
- `build/build-{hash}/terraform/` - Terraform IaC files
- `build/build-{hash}/ansible/` - Ansible playbooks

### View the Stack

Open `build/build-{hash}/index.html` in your browser to explore the infrastructure model interactively.

## Architecture Highlights

### Aspect Defaults (Three-Layer Merge)

This stack demonstrates the three-layer aspect data merge:

1. **Aspect Definition Defaults** - Defined in `aspects/*.aspect.json`
2. **Class Defaults** - Defined in `classes/*/*.schema.json` via `aspect_defaults`
3. **Instance Values** - Defined in `instances/*/*.json`

Example: Network configuration inherits from aspect defaults:

```json
// aspects/aspect_network_interface.aspect.json
{
  "bridge": "vmbr0",
  "gateway": "192.168.68.1",
  "nameserver": "192.168.68.10"
}
```

Instances only specify unique values (hostname, IP, MAC) - bridge/gateway/nameserver are inherited automatically.

### Class Hierarchy

```
infrastructure_entity
├── compute_node
│   ├── server
│   └── proxmox_lxc (inherits proxmox_guest defaults)
├── network_device
│   └── router
└── proxmox_node
```

### Mixins

**Terraform Mixin** (`mixins/terraform/`):
- Adds `aspect_terraform` aspect
- Provides Terraform templates for Proxmox provisioning
- Generates `.tf` files and variable configuration

**Ansible Mixin** (`mixins/ansible/`):
- Adds `aspect_ansible` aspect
- Provides Ansible playbook templates
- Generates configuration management playbooks

## Customization

### Network Configuration

Edit aspect defaults in `aspects/aspect_network_interface.aspect.json`:

```json
{
  "bridge": "vmbr0",           // Proxmox bridge
  "gateway": "192.168.68.1",   // Default gateway
  "nameserver": "192.168.68.10" // DNS server
}
```

### Container Defaults

Edit class defaults in `classes/infrastructure/proxmox_lxc.schema.json`:

```json
{
  "aspect_defaults": {
    "proxmox_guest": {
      "host_node": "polaris",
      "ostemplate": "local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst",
      "rootfs_storage": "local-lvm",
      "start": true,
      "unprivileged": true,
      "cmode": "shell"
    }
  }
}
```

### Instance-Specific Values

Each instance only needs unique values:

```json
{
  "id": "backbone_dns",
  "class": "proxmox_lxc",
  "aspects": {
    "proxmox_guest": {
      "vmid": 400100  // Only override vmid
    },
    "network_interface": {
      "hostname": "dns",
      "ip": "192.168.68.10",
      "mac": "BC:24:11:E3:59:DE",
      "nameserver": "192.168.68.1"  // Override default
    }
  }
}
```

Bridge and gateway are inherited from aspect defaults - no duplication needed!

## File Structure

```
backbone/
├── struktur.build.json       # Build configuration
├── aspects/                  # Aspect definitions with defaults
│   └── aspect_network_interface.aspect.json
├── classes/                  # Class schemas
│   ├── domains/              # Domain classifications
│   ├── infrastructure/       # Infrastructure classes
│   └── services/             # Service classes
├── instances/                # Instance data
│   ├── global.json          # Stack metadata
│   ├── infrastructure/      # Infrastructure instances
│   └── services/            # Service instances
└── mixins/                   # Optional mixins
    ├── terraform/           # Terraform provisioning
    └── ansible/             # Ansible configuration
```

## Deployment (Terraform)

### Prerequisites

- Proxmox VE 8.x or later
- Terraform >= 1.0
- Debian LXC template in Proxmox storage

### Configure Credentials

```bash
cd build/build-{hash}/terraform
cp .env.terraform.example .env.terraform
# Edit .env.terraform with your Proxmox API credentials
```

### Deploy

```bash
source .env.terraform
terraform init
terraform plan
terraform apply
```

## Learning Resources

- Universal Stack documentation for core concepts
- Check `canonical.json` to see the fully merged data model
- Explore the interactive viewer to understand relationships

## License

MIT - See LICENSE file
