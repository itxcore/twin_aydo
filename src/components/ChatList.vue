<template>
    <section
        class="bg-white w-full flex flex-col overflow-hidden"
        :class="{
            'collapsed-bar': collapsed,
            'md:w-16': collapsed,
            'md:w-[400px]': !collapsed,
        }"
    >
        <div class="relative h-full w-full pt-4 flex-grow-0 flex flex-col">
            <div
                class="
                    flex
                    items-center
                    collapsed-bar:flex-col-reverse
                    justify-center
                    collapsed-bar:mb-0
                    mb-2
                    flex-grow-0
                "
            >
                <div class="flex-1 collapsed-bar:mb-2 flex flex-row items-center">
                    <button
                        @click="showAddUserDialog = true"
                        class="bg-primary rounded-full text-white w-8 h-8 mx-2 collapsed-bar:w-10 collapsed-bar:h-10"
                    >
                        <i class="fas fa-plus"></i>
                    </button>
                    <h1 class="collapsed-bar:hidden pt-1">Messages</h1>
                </div>
                <div class="ml-auto collapsed-bar:m-0 collapsed-bar:mb-2 hidden md:block relative">
                    <button
                        class="
                            rounded-full
                            w-8
                            h-8
                            collapsed-bar:w-10 collapsed-bar:h-10
                            bg-gray-100
                            flex
                            justify-center
                        "
                        :class="{
                            'mr-2': !collapsed,
                        }"
                        @click="
                            collapsed = !collapsed;
                            searchValue = '';
                        "
                    >
                        <div v-if="collapsed" class="h-full flex items-center justify-center">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                        <div v-else class="h-full flex items-center justify-center">
                            <i class="fas fa-chevron-left"></i>
                        </div>
                    </button>
                    <div
                        v-if="filteredChatRequests.length > 0"
                        class="
                            hidden
                            collapsed-bar:block
                            absolute
                            -top-1
                            right-1
                            bg-accent-300
                            h-4
                            w-4
                            rounded-full
                            text-xs
                            z-10
                            align-middle
                            text-center text-white
                        "
                    >
                        {{ filteredChatRequests.length }}
                    </div>
                </div>
            </div>
            <div v-if="!collapsed" class="mt-1 mx-2 relative rounded-md shadow-sm">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input type="text" v-model='searchValue' class="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md" placeholder="Search" />
            </div>
            <div v-if="filteredChatRequests.length > 0" class="collapsed-bar:hidden px-2 mt-4">
                <h2 style="font-size: 1.5em">
                    You have
                    <span style="">
                        {{ filteredChatRequests.length }}
                    </span>
                    new connection request<span v-if="filteredChatRequests.length > 1">s</span>
                </h2>
                <ChatRequestList :chat-requests="filteredChatRequests" />
            </div>
            <div class="flex-grow overflow-auto">
                <div
                    v-if="filteredChatRequests.length === 0 && filteredChats.length == 0"
                    class="text-center collapsed-bar:hidden mt-4"
                >
                    <p>No messages yet</p>
                    <button @click="sendUpdate(true)" class="mt-2 border rounded-full px-4">Add a contact</button>
                </div>
                <div
                    class="flex flex-col justify-center items-center pt-2 px-2 collapsed-bar:px-0"
                    v-if="filteredChats && filteredChats.length"
                >
                    <ChatCard
                        v-for='chat in filteredChats'
                        :key='`${chat.chatId}-${chat.messages.length}-${chat.read[user.id]}`'
                        class='w-full rounded-lg collapsed-bar:rounded-none p-1.5 collapsed-bar:my-0 my-1 cursor-pointer'
                        @selectChat='setSelected(chat.chatId)'
                        :collapsed='collapsed'
                        :chat='chat'
                    />
                </div>
            </div>
        </div>

        <jdialog :modelValue="showAddUserDialog" @update-model-value="sendUpdate" noActions>
            <template v-slot:title>
                <h1>Invite someone to chat</h1>
            </template>
            <add-contact @closeDialog="sendUpdate(false)"> </add-contact>
        </jdialog>
    </section>
</template>

<script lang="ts">
    import moment from 'moment';
    import { useSocketActions } from '@/store/socketStore';
    import { defineComponent, ref, computed, onBeforeMount, inject } from 'vue';
    import { usechatsState, usechatsActions } from '@/store/chatStore';
    import { useAuthState, useAuthActions } from '@/store/authStore';
    import addContact from '@/components/ContactAdd.vue';
    import AvatarImg from '@/components/AvatarImg.vue';
    import ChatRequestList from '@/components/ChatRequestList.vue';
    import Dialog from '@/components/Dialog.vue';
    import ChatCard from '@/components/ChatCard.vue';
    import { startFetchStatusLoop } from '@/store/statusStore';
    import { statusList } from '@/store/statusStore';
    import { uniqBy } from 'lodash';
    import { useRouter } from 'vue-router';
    import { showAddUserDialog } from '@/services/dialogService';
    import { useScrollActions } from '@/store/scrollStore';
    import { SearchIcon } from '@heroicons/vue/solid';
    export default defineComponent({
        name: 'Apps',
        props: {
            modelValue: {
                type: Boolean,
                default: false,
            },
        },
        components: {
            addContact,
            jdialog: Dialog,
            ChatCard,
            AvatarImg,
            ChatRequestList,
            SearchIcon,
        },
        emits: ['closeDialog'],
        setup(props, context) {
            const { chats, chatRequests } = usechatsState();
            const { retrievechats } = usechatsActions();
            const collapsed = ref(false);
            let selectedId = ref('');

            const status = computed(() => {
                return statusList[selectedId.value];
            });

            const { user } = useAuthState();

            const m = val => moment(val);
            const searchValue = ref('');
            let showContacts = ref(false);

            const router = useRouter();

            const setSelected = id => {
                router.push({ name: 'single', params: { id } });
            };

            const filteredChats = computed(() => {
                if (!searchValue.value) {
                    return chats.value;
                }
                return chats.value.filter(c => c.name.toLowerCase().includes(searchValue.value.toLowerCase()));
            });
            onBeforeMount(() => {
                const { initializeSocket } = useSocketActions();
                initializeSocket(user.id.toString());
                retrievechats();
            });

            const selectedChat = computed(() => chats.value.find(chat => chat.chatId == selectedId.value));

            startFetchStatusLoop(user);

            const filteredChatRequests = computed(() => {
                const filteredChats = chatRequests.value.filter(cr => !chats.value.find(c => c.chatId === cr.chatId));

                //@ts-ignore
                return uniqBy(filteredChats, c => c.chatId);
            });

            const sendUpdate = newVal => {
                console.log('update it');
                showAddUserDialog.value = newVal;
            };

            return {
                status,
                selectedId,
                selectedChat,
                setSelected,
                chats,
                filteredChatRequests,
                searchValue,
                filteredChats,
                showContacts,
                user,
                collapsed,
                m,
                sendUpdate,
                showAddUserDialog,
            };
        },
    });
</script>

<style scoped type="text/css"></style>
