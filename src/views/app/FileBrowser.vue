<template>
    <appLayout>
        <template v-slot:default>
            <div class="flex flex-row w-full h-full">
                <div class="flex flex-col flex-1">
                    <TopBar />
                    <FileTable v-if="searchResults.length === 0 && sharedDir === false" />
                    <ResultsTable v-if="searchResults.length > 0 && sharedDir === false" />
                    <SharedContent v-if="sharedDir === true" />
                </div>
            </div>
        </template>
    </appLayout>
</template>

<script lang="ts">
    import appLayout from '../../layout/AppLayout.vue';
    import { defineComponent, onBeforeMount } from 'vue';
    import FileTable from '@/components/fileBrowser/FileTable.vue';
    import ResultsTable from '@/components/fileBrowser/ResultsTable.vue';
    import { updateContent, searchResults, sharedDir, selectedPaths, searchDirValue } from '@/store/fileBrowserStore';
    import TopBar from '@/components/fileBrowser/TopBar.vue';
    import SharedContent from '@/components/fileBrowser/SharedContent.vue';

    export default defineComponent({
        name: 'Apps',
        components: {
            TopBar,
            appLayout,
            FileTable,
            ResultsTable,
            SharedContent,
        },
        setup() {
            onBeforeMount(async () => {
                await updateContent();
                sharedDir.value = false;
                selectedPaths.value = [];
                searchResults.value = [];
                searchDirValue.value = '';
            });

            return {
                searchResults,
                sharedDir,
            };
        },
    });
</script>

<style scoped type="text/css"></style>
