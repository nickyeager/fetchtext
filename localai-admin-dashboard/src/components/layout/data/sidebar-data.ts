import {
  
  IconFile,

  IconLayoutDashboard,
  IconLock,
  IconLockAccess,
  IconMessages,
  IconNotification,
  IconPackages,
  IconPalette,
  IconServerOff,
  IconSettings,
  IconTemplate,
  IconTool,
  IconUserCog,
  IconUserOff,
  IconUsers,
  IconGitBranch,
  IconCpu,
  IconUpload,
  IconPhoto,
  IconDatabase,
} from '@tabler/icons-react'
import { AudioWaveform, Command, GalleryVerticalEnd } from 'lucide-react'
import { ClerkLogo } from '@/assets/clerk-logo'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'FetchText',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Upload Document',
          url: '/documents/upload',
          icon: IconUpload,
        },
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: IconLayoutDashboard,
        },
        {
          title: 'Documents',
          url: '/documents',
          icon: IconFile,
        },
        
        {
          title: 'Document Gallery',
          url: '/documents/gallery',
          icon: IconPhoto,
        },

        {
          title: 'Templates',
          url: '/templates',
          icon: IconTemplate,
        },
        {
          title: 'Users',
          url: '/users',
          icon: IconUsers,
        }
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: IconSettings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: IconUserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: IconTool,
            },
            {
              title: 'AI Models',
              url: '/settings/ai-models',
              icon: IconCpu,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: IconNotification,
            }
          ],
        }
      ],
    },
  ],
}
