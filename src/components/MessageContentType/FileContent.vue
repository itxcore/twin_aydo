<template>
    <a
        class="px-4 my-2 my-message:bg-accent-200"
        :href="calcExternalResourceLink(message.body.url)"
        :download='message.body.filename'
    >
        <div
            class="
                icon
                bg-gray-600
                rounded-full
                h-12
                w-12
                flex
                items-center
                justify-center
                text-white
                my-message:bg-icon
            "
        >
            <i class="fas fa-file"></i>
        </div>
        <div class="pt-2 my-message:text-icon">
            {{ message.body.filename }}
        </div>
    </a>
</template>

<script lang="ts">
    import { defineComponent } from 'vue';
    import { calcExternalResourceLink } from '@/services/urlService';

    export default defineComponent({
        name: 'FileContent',
        props: {
            message: { type: Object, required: true },
        },
        setup(props) {
            return {
                calcExternalResourceLink,
            };
        },
    });
</script>
