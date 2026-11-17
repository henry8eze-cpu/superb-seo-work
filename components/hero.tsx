'use client'

import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Volume2, Languages } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

export function Hero() {
  const { t } = useLanguage()
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' as const },
    },
  }

  return (
    <section className="pt-32 pb-20 lg:pt-40 lg:pb-28 bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left Content */}
          <motion.div variants={itemVariants} className="space-y-8">
            <div className="space-y-4">
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-2 bg-secondary/20 text-primary ps-2 pe-4 py-2 rounded-full text-sm font-medium font-poppins"
              >
                <span className="bg-primary text-white rounded-full p-1">
                  <Languages className="w-3.5 h-3.5" />
                </span>
                CEFR-aligned courses, A1 through C1
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="text-5xl md:text-6xl lg:text-7xl font-poppins font-bold text-dark-gray leading-tight text-balance"
              >
                {t('hero.title')}
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl"
              >
                {t('hero.subtitle')}
              </motion.p>
            </div>

            {/* CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link
                href="/register"
                className="bg-primary text-white px-8 py-4 rounded-xl font-poppins font-bold text-lg hover:shadow-premium transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {t('hero.cta')}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#courses"
                className="bg-white text-primary border-2 border-primary px-8 py-4 rounded-xl font-poppins font-bold text-lg hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
              >
                {t('hero.viewCourses')}
                <BookOpen className="w-5 h-5" />
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 gap-8 pt-12 border-t border-border"
            >
              <div>
                <div className="text-3xl font-poppins font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground font-inter">{t('hero.stats.studentsLabel')}</div>
              </div>
              <div>
                <div className="text-3xl font-poppins font-bold text-secondary">15+</div>
                <div className="text-sm text-muted-foreground font-inter">{t('hero.stats.teachersLabel')}</div>
              </div>
              <div>
                <div className="text-3xl font-poppins font-bold text-primary">A1-C1</div>
                <div className="text-sm text-muted-foreground font-inter">{t('hero.stats.levelsLabel')}</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: phrase-card composition */}
          <motion.div
            variants={itemVariants}
            className="relative h-[420px] lg:h-[480px] flex items-center justify-center"
          >
            {/* Back card — vocabulary drill */}
            <motion.div
              initial={{ rotate: -8, x: -20 }}
              animate={{ rotate: [-8, -6, -8], y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute start-2 top-6 w-56 bg-secondary rounded-2xl shadow-soft p-5 hidden sm:block"
            >
              <span className="text-xs font-bold font-poppins text-dark-gray/70 uppercase tracking-wide">
                A1 · Vocabulary
              </span>
              <p className="font-poppins text-2xl font-bold text-dark-gray mt-2">
                der Termin
              </p>
              <p className="text-sm text-dark-gray/70 mt-1">the appointment</p>
            </motion.div>

            {/* Front card — speaking practice */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              className="relative w-72 bg-white rounded-2xl shadow-premium p-6 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold font-poppins text-primary uppercase tracking-wide bg-primary/10 px-2.5 py-1 rounded-full">
                  B1 · Speaking
                </span>
                <span className="w-9 h-9 rounded-full bg-cream flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-primary" />
                </span>
              </div>
              <p className="font-poppins text-xl font-bold text-dark-gray leading-snug">
                &ldquo;Könnten Sie das bitte wiederholen?&rdquo;
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                &ldquo;Could you please repeat that?&rdquo;
              </p>
              <div className="flex items-center gap-1.5 mt-5 pt-4 border-t border-border">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className="w-1.5 rounded-full bg-primary/30"
                    style={{ height: `${8 + (bar % 3) * 6}px` }}
                  />
                ))}
                <span className="text-xs text-muted-foreground ms-2">0:04</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
