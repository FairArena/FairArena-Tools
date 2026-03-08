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
    // Use custom Debian image with sandbox user and tools
    image: 'debian:bookworm-slim',
    shell: '/bin/bash',
    description: 'Stable, minimal Debian. Foundation for many distros.',
    badge: 'Stable',
  },
  {
    id: 'alpine',
    label: 'Alpine 3.19',
    // Use custom Alpine image with sandbox user and tools
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
