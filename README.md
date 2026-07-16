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

## Deployment (GCP e2-micro, Always Free tier)

The app ships as a Docker image. SQLite needs a persistent disk, so this
runs on a Compute Engine VM rather than serverless/ephemeral compute.

1. Create the VM (one-time):

       gcloud compute instances create elclub-vm \
         --zone=us-central1-a \
         --machine-type=e2-micro \
         --image-family=debian-12 \
         --image-project=debian-cloud \
         --boot-disk-size=30GB

2. Install Docker on the VM:

       gcloud compute ssh elclub-vm --zone=us-central1-a \
         --command="curl -fsSL https://get.docker.com | sudo sh"

3. Build the image locally and push it to a registry (building on the
   VM's 1GB of RAM directly can be slow or run out of memory):

       docker build -t gcr.io/<PROJECT_ID>/elclub-web .
       docker push gcr.io/<PROJECT_ID>/elclub-web

4. Pull and run it on the VM, with a persistent volume for the SQLite file:

       gcloud compute ssh elclub-vm --zone=us-central1-a --command="\
         sudo docker pull gcr.io/<PROJECT_ID>/elclub-web && \
         sudo docker run -d --restart unless-stopped -p 80:3000 \
           -v /var/lib/elclub/data:/app/data \
           -e INSTAGRAM_URL=https://instagram.com/<handle> \
           gcr.io/<PROJECT_ID>/elclub-web"

5. Open port 80 in the firewall:

       gcloud compute firewall-rules create allow-http --allow=tcp:80 --target-tags=http-server
       gcloud compute instances add-tags elclub-vm --tags=http-server --zone=us-central1-a

Replace `<PROJECT_ID>` with your GCP project ID and `<handle>` with the
club's real Instagram handle.
