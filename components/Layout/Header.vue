<template>
    <header class="flex items-center w-full bg-white dark:bg-gray-950 justify-between py-10">
        <NuxtLink class="break-words" aria-label="alola.org" to="/">
            <div class="flex items-center justify-between">
                <div class="mr-3">
                    <SvgLogo />
                </div>
                <div class="hidden h-6 text-2xl font-semibold sm:block">Alola... why not?</div>
            </div>
        </NuxtLink>

        <div class="flex items-center space-x-4 leading-5 sm:space-x-6">
            <div class="no-scrollbar hidden max-w-40 items-center space-x-4 overflow-x-auto sm:flex sm:space-x-6 md:max-w-72 lg:max-w-96">
                <NuxtLink class="block font-medium text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400" href="/">Home</NuxtLink>
                <NuxtLink class="block font-medium text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400" href="/events" >Events</NuxtLink>
                <NuxtLink class="block font-medium text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400" href="/projects">Projects</NuxtLink>
                <NuxtLink class="block font-medium text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400" href="/about">About</NuxtLink>
            </div>
            <button aria-label="Search"><SvgSearch /></button>
            <div class="mr-5 flex items-center">
                <div class="relative inline-block text-left" data-headlessui-state="">
                    <div class="flex items-center justify-center hover:text-primary-500 dark:hover:text-primary-400">
                        <button aria-label="Theme switcher" id="headlessui-menu-button-:Rtpkqlb:" type="button" aria-haspopup="menu" aria-expanded="false" data-headlessui-state=""><SvgThemeSwitcher /></button>
                    </div>
                </div>
            </div>
            <button aria-label="Toggle Menu" class="sm:hidden"><SvgToggleMenu /></button>
        </div>
    </header>
</template>

<script>
export default {

}
</script>

<style lang="scss" scoped></style>