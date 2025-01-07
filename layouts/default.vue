<template>
    <div class="bg-white pl-[calc(100vw-100%)] text-black antialiased dark:bg-gray-950 dark:text-white">
        <section class="mx-auto max-w-3xl px-4 sm:px-6 xl:max-w-5xl xl:px-0">
        <LayoutHeader />
        <main class="mb-auto">
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
                <slot />
            </div>
        </main>
        <LayoutFooter />
        </section>
    </div>
</template>
