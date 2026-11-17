'use client'

import { motion } from 'framer-motion'
import { Users, Clock, Globe, Monitor, Award, Sparkles, Quote } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

const features = [
  { icon: Users, key: 'smallClasses' },
  { icon: Award, key: 'certified' },
  { icon: Clock, key: 'flexible' },
  { icon: Monitor, key: 'onlineInPerson' },
  { icon: Globe, key: 'goethe' },
  { icon: Sparkles, key: 'personalized' },
]

export function About() {
  const { t } = useLanguage()
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-secondary/20 text-primary px-4 py-2 rounded-full text-sm font-medium font-poppins mb-4">
            {t('about.badge')}
          </span>
          <h2 className="text-4xl md:text-5xl font-poppins font-bold text-dark-gray mb-4 text-balance">
            {t('about.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-inter">
            {t('about.subtitle')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="group p-8 bg-white border border-border rounded-2xl hover:shadow-premium transition-all duration-300 hover:-translate-y-1"
              >
                <motion.div
                  className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all"
                  whileHover={{ scale: 1.1 }}
                >
                  <Icon className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                </motion.div>
                <h3 className="text-xl font-poppins font-bold text-dark-gray mb-2">
                  {t(`about.features.${feature.key}`)}
                </h3>
                <p className="text-muted-foreground font-inter leading-relaxed">
                  {t(`about.features.${feature.key}Desc`)}
                </p>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 bg-dark-gray rounded-2xl p-10 md:p-14 relative overflow-hidden"
        >
          <Quote className="absolute -top-4 -start-2 w-32 h-32 text-secondary/10" strokeWidth={1} />
          <div className="max-w-3xl mx-auto relative">
            <h3 className="text-2xl md:text-3xl font-poppins font-bold text-white mb-6">
              {t('about.missionTitle')}
            </h3>
            <p className="text-lg text-white/80 font-inter leading-relaxed mb-6">
              {t('about.mission1')}
            </p>
            <p className="text-lg text-white/80 font-inter leading-relaxed">
              {t('about.mission2')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
