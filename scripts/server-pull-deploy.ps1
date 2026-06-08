$repoUrl = "https://github.com/RAYKUNJAL/nextbagchaser-studio.git"

@"
Paste this whole block into the interactive SSH shell at root@trinibuild-prod:

set -e
cd /root
rm -rf /root/opaija-runtime-backup
mkdir -p /root/opaija-runtime-backup
if [ -f /root/Opaija/.env ]; then cp /root/Opaija/.env /root/opaija-runtime-backup/.env; fi
if [ -d /root/Opaija/data ]; then cp -a /root/Opaija/data /root/opaija-runtime-backup/data; fi
if [ -d /root/Opaija/ops/projects ]; then mkdir -p /root/opaija-runtime-backup/ops && cp -a /root/Opaija/ops/projects /root/opaija-runtime-backup/ops/projects; fi
if [ -d /root/Opaija/public/generated ]; then mkdir -p /root/opaija-runtime-backup/public && cp -a /root/Opaija/public/generated /root/opaija-runtime-backup/public/generated; fi
if [ -d /root/Opaija/public/voiceover ]; then mkdir -p /root/opaija-runtime-backup/public && cp -a /root/Opaija/public/voiceover /root/opaija-runtime-backup/public/voiceover; fi
rm -rf /root/Opaija
git clone $repoUrl /root/Opaija
cd /root/Opaija
if [ -f /root/opaija-runtime-backup/.env ]; then cp /root/opaija-runtime-backup/.env /root/Opaija/.env; fi
if [ -d /root/opaija-runtime-backup/data ]; then cp -a /root/opaija-runtime-backup/data /root/Opaija/data; fi
if [ -d /root/opaija-runtime-backup/ops/projects ]; then mkdir -p /root/Opaija/ops && cp -a /root/opaija-runtime-backup/ops/projects /root/Opaija/ops/projects; fi
if [ -d /root/opaija-runtime-backup/public/generated ]; then mkdir -p /root/Opaija/public && cp -a /root/opaija-runtime-backup/public/generated /root/Opaija/public/generated; fi
if [ -d /root/opaija-runtime-backup/public/voiceover ]; then mkdir -p /root/Opaija/public && cp -a /root/opaija-runtime-backup/public/voiceover /root/Opaija/public/voiceover; fi
npm ci
npm run build
pm2 delete opaija || true
pm2 start npm --name opaija --cwd /root/Opaija -- start --update-env
pm2 save
pm2 status
curl -I http://127.0.0.1:8787/api/health
curl -I https://studio.nextbagchaser.com/login
"@
