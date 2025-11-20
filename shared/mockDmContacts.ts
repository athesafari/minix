export type MockDmContact = {
  id: string
  username: string
  display_name: string
  title: string
  avatar_url: string
}

export const MOCK_DM_CONTACTS: MockDmContact[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'launch-labs',
    display_name: 'Launch Labs',
    title: 'Product & Growth',
    avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=launch-labs'
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'growth-mate',
    display_name: 'Growth Mate',
    title: 'Lifecycle',
    avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=growth-mate'
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'dm-bot',
    display_name: 'Direct Message Bot',
    title: 'Automation',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=dm-bot'
  }
]
