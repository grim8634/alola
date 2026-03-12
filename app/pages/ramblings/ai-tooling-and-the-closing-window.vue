<template>
  <div>
    <div class="pt-12 sm:pt-20 pb-6">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Ramblings
      </span>
      <h1 class="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        AI tooling and the closing window
      </h1>
      <p class="font-body text-ink-muted mt-4 reveal reveal-d2">
        11 March 2026 · ~8 min read
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <article class="py-12 max-w-2xl space-y-8 reveal reveal-d3">

      <!-- Intro -->
      <p class="font-body text-lg leading-8 text-ink-muted">
        We're in a unique window right now. One that I think will look obvious in
        hindsight, but that most people — even technical people — haven't fully
        grasped yet. The cost of building software is collapsing, and it's
        happening faster than anyone expected.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        I'm not talking about some theoretical future. I'm talking about right now,
        today, in March 2026. I've been building things with AI tooling for months
        and the acceleration is visceral. What used to take a team weeks can be
        scaffolded in an afternoon. What used to require deep specialist knowledge
        can be handled by someone with decent judgement and the right prompts.
      </p>

      <!-- The simple stuff is solved -->
      <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight pt-4">
        The simple stuff is basically solved
      </h2>

      <p class="font-body text-lg leading-8 text-ink-muted">
        Let me give you a concrete example. I recently built
        <a href="https://scubaatlas.cc" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-light transition-colors">ScubaAtlas.cc</a>
        — a dive site and dive school directory with searchable listings, geo
        filtering, enquiry forms, an admin panel, and review moderation. Nuxt 4,
        Prisma, PostgreSQL, deployed to Vercel. Thirty-two pages, fifty-two API
        routes, full admin dashboard.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        The initial MVP took a couple of days. Not a couple of sprints. Days. And
        I wasn't writing most of the code — I was directing an AI agent, reviewing
        its output, course-correcting when it went sideways, and making
        architectural decisions. The ratio of thinking to typing has completely
        inverted.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        Same story with
        <a href="https://npsi.rocks" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-light transition-colors">NPSI Fleets</a>,
        an EVE Online fleet management tool. Database schema, API routes, an EFT
        fitting parser, ESI integration, real-time fleet composition tracking —
        all stood up in a single session. The kind of project that would have
        been a solid month of evenings a few years ago.
      </p>

      <!-- The chart -->
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 sm:p-8 my-8">
        <h3 class="font-display text-sm font-semibold uppercase tracking-[0.15em] text-accent mb-6">
          Time to functional MVP
        </h3>
        <div class="space-y-5">
          <div v-for="item in timelineData" :key="item.label">
            <div class="flex justify-between items-baseline mb-1.5">
              <span class="font-display text-sm font-semibold text-ink">{{ item.label }}</span>
              <span class="font-body text-xs text-ink-muted">{{ item.time }}</span>
            </div>
            <div class="h-3 bg-surface-subtle rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-1000"
                :class="item.color"
                :style="{ width: item.width }"
              />
            </div>
          </div>
        </div>
        <p class="font-body text-xs text-ink-faint mt-4 italic">
          Approximate development time for comparable scope projects — my experience, 2023 vs 2026.
        </p>
      </div>

      <!-- The hard stuff -->
      <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight pt-4">
        But the hard stuff is where it gets interesting
      </h2>

      <p class="font-body text-lg leading-8 text-ink-muted">
        Simple projects are one thing. What about the genuinely complex ones?
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        At Cartridge Save, we're working through a migration of our main
        e-commerce platform from Nuxt 2 to Nuxt 4. If you're not in the Vue
        ecosystem, just know this: it's not a version bump. It's closer to a
        philosophical shift. Almost everything about how you structure a Vue
        application changed between these versions.
      </p>

      <!-- Migration pain points -->
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 sm:p-8 my-8">
        <h3 class="font-display text-sm font-semibold uppercase tracking-[0.15em] text-accent mb-5">
          The migration landscape
        </h3>
        <div class="space-y-4">
          <div v-for="point in migrationPoints" :key="point.from" class="flex items-start gap-3">
            <span class="text-accent font-display text-lg leading-none mt-0.5">→</span>
            <div>
              <span class="font-display text-sm font-semibold text-ink">{{ point.from }}</span>
              <span class="font-body text-sm text-ink-faint mx-2">becomes</span>
              <span class="font-display text-sm font-semibold text-accent">{{ point.to }}</span>
              <p class="font-body text-sm text-ink-muted mt-1">{{ point.note }}</p>
            </div>
          </div>
        </div>
      </div>

      <p class="font-body text-lg leading-8 text-ink-muted">
        On top of that, we're migrating from Vue Storefront's older API layer to
        modern equivalents. The VSF middleware that used to handle API abstraction,
        the composables that wrapped their SDK — all of it needs rethinking.
        Custom integrations, payment flows, search, the lot. You can't just find
        and replace your way through it.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        This is where AI tooling gets genuinely useful — and where it still needs
        a human at the wheel. An AI agent can convert an Options API component to
        Composition API in seconds. It can refactor a Vuex module to Pinia
        beautifully. It understands the patterns. What it can't do — yet — is
        understand <em>why</em> a piece of code exists in a legacy codebase, what
        business logic is hiding in that computed property, or what happens
        downstream when you change how the cart state is structured.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        That's the oversight window I'm talking about. Right now, in 2026, you
        still need someone who understands the domain, the architecture, and the
        consequences. The AI is an extraordinarily capable pair of hands, but it
        needs a brain directing it. The question is: how long does that remain
        true?
      </p>

      <!-- The window -->
      <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight pt-4">
        The window is closing
      </h2>

      <p class="font-body text-lg leading-8 text-ink-muted">
        Six months ago, AI coding tools could autocomplete functions and suggest
        boilerplate. Today, I'm having an agent build entire features end-to-end
        — database schema, API routes, frontend pages, tests — while I review
        the output and steer. I spawn sub-agents for parallel workstreams. I
        describe what I want in plain English and get back working, deployable
        code.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        The trajectory is clear. The things that still require human oversight
        today — complex migrations, nuanced architectural decisions, understanding
        legacy business logic — are exactly the kinds of problems these models
        are getting better at. Context windows are growing. Reasoning is
        improving. The ability to hold an entire codebase in working memory and
        understand the ripple effects of a change is getting closer.
      </p>

      <!-- Timeline visual -->
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 sm:p-8 my-8">
        <h3 class="font-display text-sm font-semibold uppercase tracking-[0.15em] text-accent mb-6">
          The oversight spectrum
        </h3>
        <div class="relative">
          <div class="h-2 bg-surface-subtle rounded-full" />
          <div class="flex justify-between mt-4 text-center">
            <div class="flex-1">
              <div class="w-3 h-3 bg-accent rounded-full mx-auto mb-2" />
              <span class="font-display text-xs font-semibold text-accent block">2024</span>
              <span class="font-body text-xs text-ink-faint">AI suggests<br>Human writes</span>
            </div>
            <div class="flex-1">
              <div class="w-3 h-3 bg-accent-light rounded-full mx-auto mb-2" />
              <span class="font-display text-xs font-semibold text-accent-light block">Now</span>
              <span class="font-body text-xs text-ink-faint">AI writes<br>Human reviews</span>
            </div>
            <div class="flex-1">
              <div class="w-3 h-3 bg-ink-faint rounded-full mx-auto mb-2" />
              <span class="font-display text-xs font-semibold text-ink-faint block">Soon</span>
              <span class="font-body text-xs text-ink-faint">AI builds<br>Human approves</span>
            </div>
            <div class="flex-1">
              <div class="w-3 h-3 bg-ink-faint/50 rounded-full mx-auto mb-2" />
              <span class="font-display text-xs font-semibold text-ink-faint/50 block">20??</span>
              <span class="font-body text-xs text-ink-faint">AI delivers<br>Human uses</span>
            </div>
          </div>
        </div>
      </div>

      <!-- What this means -->
      <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight pt-4">
        What this means if you lead a team
      </h2>

      <p class="font-body text-lg leading-8 text-ink-muted">
        If you're a tech lead or CTO reading this, the implications are
        significant and they're arriving faster than your planning cycle
        accounts for.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        <strong class="text-ink">The value of technical oversight is at a premium — temporarily.</strong>
        Right now, the people who can direct AI tools effectively and review their
        output critically are absurdly productive. A senior developer with good AI
        tooling can outpace a small team. But this advantage is a feature of the
        transition, not the destination. As the tools improve, the bar for useful
        oversight drops.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        <strong class="text-ink">Legacy migrations are the immediate opportunity.</strong>
        If you've been putting off a major framework migration or platform
        modernisation because of the cost, the equation has changed. What would
        have been a six-month project with a dedicated team can now be tackled in
        weeks with AI-assisted development and experienced oversight. The ROI on
        technical debt reduction just got dramatically better.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        <strong class="text-ink">Hire for judgement, not just output.</strong>
        The developers who will thrive aren't necessarily the fastest typists or
        the ones who've memorised the most APIs. They're the ones who can evaluate
        whether a solution is correct, maintainable, and appropriate for the
        context. Code review skills matter more than code writing skills. That's
        a weird sentence to write, but it's where we are.
      </p>

      <!-- Closing -->
      <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight pt-4">
        Cautious optimism
      </h2>

      <p class="font-body text-lg leading-8 text-ink-muted">
        I'm genuinely excited about what's possible. Building ScubaAtlas and NPSI
        Fleets has been <em>fun</em> in a way that development hasn't been for a
        while. The tedious parts are handled. The creative, architectural,
        problem-solving parts remain — and those are the parts I actually enjoy.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        But I'm also watching this with clear eyes. The window where human
        technical oversight is essential is closing. Not tomorrow, not next month,
        but it's visibly narrowing. The question isn't whether AI will be able to
        handle complex migrations and architectural decisions autonomously — it's
        when.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        For now, we're in the sweet spot. The tools are powerful enough to be
        transformative but not yet capable enough to be autonomous. If you're
        technical, lean into it. If you lead a team, tool up. If you've been
        putting off that migration — this is your moment.
      </p>

      <p class="font-body text-lg leading-8 text-ink-muted">
        The window's open. It won't be forever.
      </p>

      <!-- Back link -->
      <div class="pt-8 border-t border-ink-faint/10">
        <NuxtLink
          to="/ramblings"
          class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint hover:text-accent transition-colors"
        >
          &larr; All ramblings
        </NuxtLink>
      </div>
    </article>
  </div>
</template>

<script setup>
useHead({
  title: 'AI tooling and the closing window',
  meta: [{ name: 'description', content: 'We\'re in a unique moment for software development. The cost of building is collapsing, and the window where human oversight is essential is visibly narrowing.' }],
})

const timelineData = [
  { label: 'Dive directory (2023 approach)', time: '~6 weeks', width: '100%', color: 'bg-ink-faint' },
  { label: 'Dive directory (2026, AI-assisted)', time: '~2 days', width: '5%', color: 'bg-accent' },
  { label: 'Fleet management tool (2023)', time: '~4 weeks', width: '67%', color: 'bg-ink-faint' },
  { label: 'Fleet management tool (2026)', time: '~1 day', width: '3%', color: 'bg-accent' },
  { label: 'E-commerce migration (2023)', time: '~6 months', width: '100%', color: 'bg-ink-faint' },
  { label: 'E-commerce migration (2026)', time: '~6 weeks*', width: '17%', color: 'bg-accent-light' },
]

const migrationPoints = [
  {
    from: 'Options API',
    to: 'Composition API',
    note: 'Every component rewritten. Mixins become composables. The mental model changes completely.',
  },
  {
    from: 'Vuex',
    to: 'Pinia',
    note: 'State management reimagined. Modules become stores. Mutations disappear. Actions simplify.',
  },
  {
    from: 'Webpack',
    to: 'Vite',
    note: 'Build tooling swap. Most config is gone, but edge cases in loaders and plugins surface everywhere.',
  },
  {
    from: 'Vue Storefront middleware',
    to: 'Direct API / Nitro server routes',
    note: 'The entire API abstraction layer needs rethinking. Custom integrations, payment flows, search — all of it.',
  },
  {
    from: 'Nuxt 2 module ecosystem',
    to: 'Nuxt 4 modules',
    note: 'Many modules don\'t have equivalents yet. Others have completely different APIs. Some you just rewrite.',
  },
]
</script>
