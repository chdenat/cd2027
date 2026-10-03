#!/usr/bin/env bash
set -euo pipefail

required=(CD2027_SSH_HOST CD2027_SSH_USER CD2027_SSH_PASSWORD CD2027_REMOTE_ROOT)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Required environment variable is missing: %s\n' "$name" >&2
    exit 1
  fi
done

port="${CD2027_SSH_PORT:-22}"
if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || ((port < 1 || port > 65535)); then
  echo 'CD2027_SSH_PORT must be between 1 and 65535.' >&2
  exit 1
fi

if [[ ! "$CD2027_SSH_HOST" =~ ^[A-Za-z0-9.-]+$ || ! "$CD2027_SSH_USER" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'CD2027_SSH_HOST or CD2027_SSH_USER contains unsupported characters.' >&2
  exit 1
fi

remote_root="$CD2027_REMOTE_ROOT"
if [[ ! "$remote_root" =~ ^/[A-Za-z0-9._/-]+$ || "$remote_root" == '/' || "$remote_root" == *'//'* ]]; then
  echo 'CD2027_REMOTE_ROOT must be an absolute path without spaces or repeated slashes.' >&2
  exit 1
fi
IFS='/' read -r -a path_parts <<< "$remote_root"
for part in "${path_parts[@]}"; do
  if [[ "$part" == '.' || "$part" == '..' ]]; then
    echo 'CD2027_REMOTE_ROOT cannot contain dot path segments.' >&2
    exit 1
  fi
done

if [[ ! -s _site/index.html || ! -s _site/sitemap.xml ]]; then
  echo 'The checked Eleventy build is missing _site/index.html or _site/sitemap.xml.' >&2
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1 || ! command -v scp >/dev/null 2>&1; then
  echo 'Install sshpass and OpenSSH client tools in the GitHub runner before uploading.' >&2
  exit 1
fi

known_hosts_file="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/cd2027-known-hosts-${GITHUB_RUN_ID:-manual}"
touch "$known_hosts_file"
chmod 600 "$known_hosts_file"

release_id="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}-${GITHUB_SHA:-local}"
release_id="${release_id//[^A-Za-z0-9._-]/-}"
release_dir="$remote_root/releases/$release_id"
incoming_archive="$remote_root/incoming/$release_id.tar.gz"
next_link="$remote_root/.current-$release_id"
target="$CD2027_SSH_USER@$CD2027_SSH_HOST"
ssh_options=(-p "$port" -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$known_hosts_file" -o ConnectTimeout=20 -o PreferredAuthentications=password,keyboard-interactive -o PubkeyAuthentication=no)

export SSHPASS="$CD2027_SSH_PASSWORD"
unset CD2027_SSH_PASSWORD

archive="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/cd2027-${release_id}.tar.gz"
tar -czf "$archive" -C _site .

sshpass -e ssh "${ssh_options[@]}" "$target" "mkdir -p '$remote_root/releases' '$remote_root/incoming'"
sshpass -e scp -P "$port" -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$known_hosts_file" -o ConnectTimeout=20 -o PreferredAuthentications=password,keyboard-interactive -o PubkeyAuthentication=no \
  "$archive" "$target:$incoming_archive"

sshpass -e ssh "${ssh_options[@]}" "$target" "set -eu; if [ -e '$remote_root/current' ] && [ ! -L '$remote_root/current' ]; then echo 'Refusing to replace a non-symlink current path.' >&2; exit 1; fi; mkdir '$release_dir'; tar -xzf '$incoming_archive' -C '$release_dir'; ln -s '$release_dir' '$next_link'; mv -Tf '$next_link' '$remote_root/current'; rm -f '$incoming_archive'"

rm -f "$archive"
printf 'Static CD2027 build promoted to %s/current\n' "$remote_root"
