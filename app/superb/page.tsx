import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { About } from '@/components/about'
import { Pricing } from '@/components/pricing'
import { Contact } from '@/components/contact'
import { Footer } from '@/components/footer'
import { UpcomingCourses } from '@/components/market/upcoming-courses'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'Superb Sprachschule - Learn German Online',
  description: 'CEFR-aligned German courses in Essen and online, from A1 through Goethe and TestDaF exam preparation.',
}

// The original Superb Sprachschule landing page. Its course list now shows the
// school's real, bookable intakes from the marketplace instead of hard-coded cards.
export default async function SuperbHome() {
  const school = await prisma.school.findFirst({ where: { slug: 'superb-sprachschule-essen' }, select: { id: true } })
  return (
    <main className="bg-cream">
      <Navbar />
      <Hero />
      <About />
      <UpcomingCourses schoolId={school?.id} />
      <Pricing />
      <Contact />
      <Footer />
    </main>
  )
}
