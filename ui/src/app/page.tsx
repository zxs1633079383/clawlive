'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const features = [
  {
    icon: '🎙️',
    title: 'Real-time STT',
    description:
      'Browser-native speech-to-text captures every word as it is spoken.',
  },
  {
    icon: '🦞',
    title: 'AI Lobster Assistants',
    description:
      'Each participant gets a personal lobster with a unique skill set.',
  },
  {
    icon: '💬',
    title: 'Inter-lobster Dialogue',
    description:
      'Your lobsters collaborate behind the scenes to surface better insights.',
  },
  {
    icon: '📋',
    title: 'Meeting Summaries',
    description:
      'Automatic post-meeting summaries with action items and key decisions.',
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="animate-fade-in text-center">
          <h1 className="mb-2 text-6xl font-bold tracking-tight sm:text-7xl">
            <span className="text-gradient">Clawlive</span>{' '}
            <span className="inline-block animate-pulse-soft">🦞</span>
          </h1>

          <p className="mx-auto mt-4 max-w-md text-xl text-text-secondary">
            Every voice deserves a lobster
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/lobby">
              <Button size="lg">Create Meeting</Button>
            </Link>
            <Link href="/lobby">
              <Button variant="secondary" size="lg">
                Join Meeting
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="animate-slide-up glass-hover p-6 text-center"
            >
              <div className="mb-3 text-4xl">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-sm text-text-muted">
        Clawlive &mdash; AI-powered meeting collaboration
      </footer>
    </main>
  );
}
