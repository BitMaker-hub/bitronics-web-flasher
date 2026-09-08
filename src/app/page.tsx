'use client'

import Footer from '@/components/Footer'
import LandingHero from '@/components/LandingHero'
import Features from '@/components/Features'
import Releases from '@/components/Releases'
import ShopStrip from '@/components/ShopStrip'

// Dark hero, gold strip, light band, dark band, dark footer. The page alternates
// rather than running black end to end, which is how the pool site reads.
export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <LandingHero />
        <ShopStrip />
        <Features />
        <Releases />
      </main>
      <Footer />
    </div>
  )
}
