import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title', // Shows the title in the Admin list view
  },
  access: {
    read: () => true, // Allows public access so SvelteKit can fetch it
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea', // Use 'richText' if you want a full editor
      required: true,
    },
  ],
}