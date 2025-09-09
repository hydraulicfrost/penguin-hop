import NoSSR from '@/components/no-ssr'
import GameClient from '@/components/game-client'

export default function GamePlatform() {
  return (
    <NoSSR>
      <GameClient />
    </NoSSR>
  )
}