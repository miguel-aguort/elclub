# El Club

Marketing site for the mountain club, with a community signup form.

## Development

    npm install
    npm run dev

Visit http://localhost:3000.

## Testing

    npm test

## Configuration

Copy `.env.local.example` to `.env.local` and set `INSTAGRAM_URL`
to the club's real Instagram profile URL before deploying.

Also set `ADMIN_PASSWORD` to a password of your choice — it protects
`/admin` (survey builder and results) and `/api/admin/*`. There's no
per-admin account, just this one shared password.

## Deployment (AWS EC2 t3.micro, Free Tier)

The app ships as a Docker image. SQLite needs a persistent disk, so this
runs on an EC2 instance rather than serverless/ephemeral compute (Fargate,
App Runner, and Lambda all use ephemeral storage).

### Current deployment

| Resource | Value |
|---|---|
| Region | `eu-west-1` (Ireland) |
| EC2 instance | `i-0627b0a9c7ea8b917` (`elclub-vm`, `t3.micro`) |
| Elastic IP | `54.229.19.96` |
| Public DNS | `ec2-54-229-19-96.eu-west-1.compute.amazonaws.com` |
| Security group | `sg-0e5122b0398e21df3` (`elclub-sg`) — port 22 from the admin's IP, port 80 open |
| Key pair | `elclub-key` — private key kept at `~/.ssh/elclub-key.pem`, not in this repo |
| HTTPS | CloudFront distribution `E13HY3D347X2FT` → `https://d2j81974fiq5fc.cloudfront.net` |
| ECR repo | `862330372611.dkr.ecr.eu-west-1.amazonaws.com/elclub-web` — created, currently unused (see "Updating the app") |

Plain HTTP directly on the Elastic IP still works but isn't the public
URL to share — use the CloudFront HTTPS URL above (or a real domain,
once the club has one, pointed at that distribution).

### One-time setup (for a fresh deployment)

A key pair to SSH in with, and a security group allowing SSH from your
IP and HTTP from anywhere:

    aws ec2 create-key-pair --key-name elclub-key \
      --query "KeyMaterial" --output text > elclub-key.pem
    chmod 400 elclub-key.pem

    aws ec2 create-security-group --group-name elclub-sg \
      --description "elclub web"
    aws ec2 authorize-security-group-ingress --group-name elclub-sg \
      --protocol tcp --port 22 --cidr "$(curl -s ifconfig.me)/32"
    aws ec2 authorize-security-group-ingress --group-name elclub-sg \
      --protocol tcp --port 80 --cidr 0.0.0.0/0

Launch the instance. `t3.micro` (750 hrs/month) and a 30GB `gp3` root
volume are both covered by the free tier for the first 12 months on a
new account:

    aws ec2 run-instances \
      --image-id <AMAZON_LINUX_2023_AMI_ID> \
      --instance-type t3.micro \
      --count 1 \
      --key-name elclub-key \
      --security-group-ids <SECURITY_GROUP_ID> \
      --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
      --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=elclub-vm}]'

Look up the current Amazon Linux 2023 AMI id for your region with:

    aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
      --query "Parameters[0].Value" --output text

Allocate and associate an Elastic IP, so the address survives a reboot
(free while attached to a running instance):

    aws ec2 allocate-address --domain vpc
    aws ec2 associate-address --instance-id <INSTANCE_ID> --allocation-id <ALLOC_ID>

Install Docker on the instance:

    ssh -i elclub-key.pem ec2-user@<ELASTIC_IP> \
      "sudo dnf install -y docker && sudo systemctl enable --now docker"

Create the data directory and start the container the first time (see
"Updating the app" below for how the image actually gets there):

    ssh -i elclub-key.pem ec2-user@<ELASTIC_IP> "\
      sudo mkdir -p /var/lib/elclub/data && \
      sudo docker run -d --restart unless-stopped -p 80:3000 \
        -v /var/lib/elclub/data:/app/data \
        -e INSTAGRAM_URL=https://instagram.com/<handle> \
        -e ADMIN_PASSWORD=<password> \
        --name elclub-web \
        elclub-web:latest"

### Updating the app

An ECR repo exists (`elclub-web`), but pulling an ECR auth token turned
out to be blocked in the environment this was deployed from (treated as
a sensitive credential-retrieval action). Until that's sorted out, ship
new builds straight to the instance instead of through ECR:

    docker build -t elclub-web:latest .
    docker save elclub-web:latest | gzip > elclub-web.tar.gz
    scp -i ~/.ssh/elclub-key.pem elclub-web.tar.gz ec2-user@54.229.19.96:/tmp/
    ssh -i ~/.ssh/elclub-key.pem ec2-user@54.229.19.96 "\
      gunzip -c /tmp/elclub-web.tar.gz | sudo docker load && \
      rm /tmp/elclub-web.tar.gz && \
      sudo docker stop elclub-web && sudo docker rm elclub-web && \
      sudo docker run -d --restart unless-stopped -p 80:3000 \
        -v /var/lib/elclub/data:/app/data \
        -e INSTAGRAM_URL=https://instagram.com/<handle> \
        -e ADMIN_PASSWORD=<password> \
        --name elclub-web \
        elclub-web:latest"

If ECR access gets sorted out later, `docker push`/`docker pull` against
`862330372611.dkr.ecr.eu-west-1.amazonaws.com/elclub-web` is the cleaner
path — the repo is already there waiting.

### HTTPS

A CloudFront distribution sits in front of the instance, terminating TLS
with the free default `*.cloudfront.net` certificate and forwarding to
the instance over plain HTTP on port 80 (AWS's internal network, not the
public internet). No custom domain or ACM certificate needed. Costs
nothing extra — within CloudFront's free tier (1TB/month egress, 10M
requests, for the first 12 months).

Once the club has a real domain, point it at the CloudFront distribution
and request an ACM certificate for it (also free) instead of relying on
the `cloudfront.net` address.

### Custom domain (in progress)

The club now owns `elclubmanzanareselreal.es` (registered at Arsys). Setup
so far:

| Resource | Value |
|---|---|
| Domain | `elclubmanzanareselreal.es` |
| Registrar | Arsys — nameservers delegated to Route 53 |
| Route 53 hosted zone | `Z0570686MWDO6UJFNOZY`, with alias A-records for the apex and `www` pointing at the CloudFront distribution |
| ACM certificate | `arn:aws:acm:us-east-1:862330372611:certificate/8072e154-7c37-4c4b-81bf-6c0bcc4f341b` (`us-east-1`, required for CloudFront), covering `elclubmanzanareselreal.es` and `www.elclubmanzanareselreal.es`, DNS validation records already added to the hosted zone |

Remaining steps, once the Arsys nameserver change has propagated to the
`.es` registry (can take from minutes up to 24-48h) and the certificate
status flips from `PENDING_VALIDATION` to `ISSUED`:

1. Update the CloudFront distribution (`E13HY3D347X2FT`) to add
   `elclubmanzanareselreal.es` and `www.elclubmanzanareselreal.es` as
   aliases, and switch its viewer certificate from the default
   `*.cloudfront.net` one to the ACM certificate above (SNI-only).
2. Verify both the apex and `www` serve the site over HTTPS with a valid
   certificate, then share the real domain instead of the
   `cloudfront.net` URL.

### Checking logs

    ssh -i ~/.ssh/elclub-key.pem ec2-user@54.229.19.96

    sudo docker logs elclub-web          # full app log
    sudo docker logs -f elclub-web       # follow live
    sudo docker ps                       # running state, restart count
    sudo journalctl -u docker            # docker daemon log
    sudo journalctl -k | grep -i oom     # out-of-memory kills (t3.micro has 1GB RAM)

CloudFront access logging isn't enabled — only the origin's own logs
exist right now.

### Data persistence

The SQLite file lives at `/var/lib/elclub/data/subscribers.db` on the
host, bind-mounted into the container at `/app/data`. It survives
container restarts, crashes, and image updates, since it's never part
of the container's own writable layer.

It does **not** survive the EC2 instance or its EBS volume being deleted
— there's currently no backup of subscriber data beyond that single
disk. Worth adding an EBS snapshot schedule or a cron job that copies
the file to S3 before this holds any meaningful number of signups.

Replace `<AMAZON_LINUX_2023_AMI_ID>`, `<INSTANCE_ID>`, `<ALLOC_ID>`,
`<SECURITY_GROUP_ID>`, `<ELASTIC_IP>` and `<handle>` as you go.

Cost: free for the first 12 months on a new AWS account (750 hrs/month of
`t3.micro`, 30GB of EBS, and CloudFront's free tier all apply). After
that, expect roughly $7-8/month for the instance plus $2-3/month for the
EBS volume; CloudFront stays essentially free at this traffic level.
