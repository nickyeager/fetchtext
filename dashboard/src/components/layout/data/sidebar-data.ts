import {
  IconFile,
  IconLayoutDashboard,
  IconNotification,
  IconSettings,
  IconTemplate,
  IconTool,
  IconUserCog,
  IconCpu,
  IconUpload,
  IconCode,
} from '@tabler/icons-react'
import { Command } from 'lucide-react'
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
      plan: 'Document Intelligence',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: IconLayoutDashboard,
        },
        {
          title: 'Upload Document',
          url: '/documents/upload',
          icon: IconUpload,
        },
        {
          title: 'Documents',
          url: '/documents',
          icon: IconFile,
        },
        {
          title: 'Templates',
          url: '/templates',
          icon: IconTemplate,
        },
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
              title: 'Developer',
              url: '/settings/developer',
              icon: IconCode,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: IconNotification,
            },
          ],
        },
      ],
    },
  ],
}
