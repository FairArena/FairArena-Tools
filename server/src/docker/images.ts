export interface OsImage {
  id: string
  label: string
  image: string
  shell: string
  description: string
  badge: string
}

export const OS_IMAGES: OsImage[] = [
  {
    id: 'ubuntu',
    label: 'Ubuntu 22.04',
    image: 'ubuntu:22.04',
    shell: '/bin/bash',
    description: 'Most popular Linux distro. Great for beginners.',
    badge: 'LTS',
  },
  {
    id: 'debian',
    label: 'Debian 12',
    // Use official Debian slim image (pulled from Docker Hub). The slim
    // variant may not include bash in minimal variants, so use /bin/sh
    // as a compatible fallback.
    image: 'debian:bookworm-slim',
    shell: '/bin/sh',
    description: 'Stable, minimal Debian. Foundation for many distros.',
    badge: 'Stable',
  },
  {
    id: 'alpine',
    label: 'Alpine 3.19',
    // Alpine is tiny and uses /bin/sh (busybox ash). Pull the official
    // Alpine image from Docker Hub so hosts without local builds can run it.
    image: 'alpine:3.19',
    shell: '/bin/sh',
    description: 'Ultra-lightweight Linux. Only 5 MB. Uses musl libc.',
    badge: 'Tiny',
  },
  {
    id: 'fedora',
    label: 'Fedora 40',
    image: 'fedora:40',
    shell: 'bash',
    description: 'Cutting-edge RHEL-based distro. Uses DNF package manager.',
    badge: 'Latest',
  },
  {
    id: 'archlinux',
    label: 'Arch Linux',
    image: 'archlinux:base',
    shell: 'bash',
    description: 'Rolling release. Minimal base. For the adventurous.',
    badge: 'Rolling',
  },
]

export function getOsImage(id: string): OsImage | undefined {
  return OS_IMAGES.find((img) => img.id === id)
}
