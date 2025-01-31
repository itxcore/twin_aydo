<template>
    <div
        class="group flex flex-row lg:flex-row"
        :class="{
            'mb-2': isLastMessage,
            'my-message flex-row-reverse ': isMine,
        }"
        v-if="message.type !== MessageTypes.SYSTEM"
        @click="selectedMessageId = message.id"
    >
        <AvatarImg
            small
            class="mx-2"
            :class="{
                'opacity-0': !isLastMessage,
            }"
            :id="message.from"
            :showOnlineStatus="false"
        />
        <div class="flex-1">
            <div class="flex flex-row flex-wrap my-message:flex-row-reverse lg:my-message:flex-row">
                <div
                    tabindex="0"
                    class="
                        flex flex-col
                        rounded-md rounded-r-xl
                        mb-1
                        bg-white
                        shadow
                        relative
                        overflow-hidden
                        my-message:bg-accent-200
                        focus:outline-none
                        focus:ring-4
                        ring-accent-500
                        ring-offset-2

                    "
                    :class="{
                        'rounded-tl-xl': isFirstMessage,
                        'rounded-bl-xl': isLastMessage,
                    }"
                >
                    <header
                        class="p-4 pt-2 pb-2 font-bold my-message:bg-accent-300"
                        v-if="isFirstMessage && isGroup"
                    >
                        {{ message.from }}
                    </header>
                    <main class="max-w-[500px] break-all flex justify-between min-h-[36px]">
                        <MessageContent :message="message" :key="message.type"></MessageContent>
                    </main>
                    <div class="h-9 flex items-center absolute right-1.5 -bottom-3 hidden my-message:block">
                        <i class="fas fa-check-double text-accent-300" v-if="isread"></i>
                        <i class="fas fa-check text-gray-400" v-else></i>
                    </div>
                </div>

                <div
                    class="group-hover:flex pb-4 pl-4 md:hidden mt-auto xl:sticky xl:bottom-0"
                    :class="{ flex: selectedMessageId === message.id, hidden: selectedMessageId !== message.id }"
                >
                    <span
                        class="reply text-xs pr-4 cursor-pointer hover:underline hidden my-message:inline"
                        @click="editMessage(message)"
                        v-if="message.type === MessageTypes.STRING || message.type === MessageTypes.QUOTE"
                    >
                        <i class="fa fa-pen"></i>
                        <span class="text-gray-600 pl-2">Edit</span>
                    </span>
                    <span class="reply text-xs pr-4 cursor-pointer hover:underline" @click="replyMessage(message)">
                        <i class="fa fa-reply"></i>
                        <span class="text-gray-600 pl-2"> Reply</span>
                    </span>
                    <span
                        class="delete text-xs pr-4 cursor-pointer hover:underline hidden my-message:inline"
                        @click="deleteMessage(message)"
                        v-if="message.type !== 'DELETE'"
                    >
                        <i class="fa fa-trash"></i>
                        <span class="text-gray-600 pl-2">Delete</span>
                    </span>
                    <div class="pr-4 text-gray-600 date inline-block text-xs">
                        <!--<span v-if="message.updated" class="mr-4">edited</span>-->
                        <Time :time="new Date(message.timeStamp)" />
                        <!-- {{ message }} -->
                    </div>
                </div>
            </div>

            <div class="flex flex-col mb-4 ml-4 border-l-2 pl-2" v-if="message.replies?.length > 0">
                <div class="text-gray-400 self-start">Replies:</div>
                <div v-for="reply in message.replies" :key="reply.id" class="card flex mb-1">
                    <AvatarImg class="mr-2" small :id="reply.from" :showOnlineStatus="false" />

                    <div
                        class="flex rounded-xl overflow-hidden"
                        :class="{
                            'bg-white': reply.from !== user.id,
                            'bg-accent-300': reply.from === user.id,
                        }"
                    >
                        <main class="max-w-[750px] break-all flex justify-between">
                            <MessageContent :message="reply"></MessageContent>
                        </main>
                    </div>

                    <div style="margin-top: auto" class="actions pb-4 pl-4 flex">
                        <span
                            class="reply text-xs pr-4 cursor-pointer hover:underline"
                            @click="deleteReply(message, reply)"
                            v-if="reply.from === user?.id && reply.body !== 'Message has been deleted'"
                        >
                            <i class="fa fa-trash"></i>
                            <span class="text-gray-600 pl-2">Delete</span>
                        </span>
                        <div class="pr-4 text-gray-600 date inline-block text-xs">
                            <Time :time="new Date(message.timeStamp)" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-else>
        <MessageContent :message="message"></MessageContent>
    </div>
</template>

<script lang="ts">
    import { computed, defineComponent, nextTick, onMounted } from 'vue';
    import moment from 'moment';
    import AvatarImg from '@/components/AvatarImg.vue';
    import MessageContent from '@/components/MessageContent.vue';
    import { Message, MessageBodyType, QuoteBodyType, StringMessageType, MessageTypes } from '@/types';
    import { uuidv4 } from '@/common';
    import { useAuthState } from '@/store/authStore';
    import {
        clearMessageAction,
        MessageAction,
        sendMessageObject,
        setMessageAction,
        usechatsActions,
        selectedMessageId,
    } from '@/store/chatStore';
    import { useScrollActions } from '@/store/scrollStore';
    import { clock } from '@/services/clockService';
    import Time from '@/components/Time.vue';

    export default defineComponent({
        name: 'MessageCard',
        components: { Time, MessageContent, AvatarImg },
        props: {
            message: Object,
            chatId: String,
            isMine: Boolean,
            isGroup: Boolean,
            isreadbyme: Boolean,
            isread: Boolean,
            isFirstMessage: Boolean,
            isLastMessage: Boolean,
        },
        setup(props) {
            const { user } = useAuthState();

            const toggleSendForwardMessage = () => {
                console.log('toggleSendForwardMessage');
            };

            const replyMessage = message => {
                clearMessageAction(props.chatId);
                //nextTick is needed because vue throws dom errors if you switch between Reply and Edit
                nextTick(() => {
                    setMessageAction(props.chatId, message, MessageAction.REPLY);
                });
            };

            const { addScrollEvent } = useScrollActions();

            onMounted(() => {
                addScrollEvent();
            });

            const read = () => {
                const { readMessage } = usechatsActions();
                readMessage(props.chatId, props.message.id);
            };

            if (!props.isreadbyme) {
                read();
            }

            const deleteMessage = message => {
                //@todo: show dialog
                const updatedMessage: Message<StringMessageType> = {
                    id: message.id,
                    from: message.from,
                    to: message.to,
                    body: 'Message has been deleted',
                    timeStamp: message.timeStamp,
                    type: MessageTypes.DELETE,
                    replies: [],
                    subject: null,
                };
                sendMessageObject(props.chatId, updatedMessage);
            };

            const deleteReply = (message, reply) => {
                //@todo: show dialog
                const updatedMessage: Message<StringMessageType> = {
                    id: reply.id,
                    from: reply.from,
                    to: reply.to,
                    body: 'Message has been deleted',
                    timeStamp: message.timeStamp,
                    type: MessageTypes.DELETE,
                    replies: [],
                    subject: message.id,
                };
                sendMessageObject(props.chatId, updatedMessage);
            };

            const editMessage = message => {
                clearMessageAction(props.chatId);
                //nextTick is needed because vue throws dom errors if you switch between Reply and Edit
                nextTick(() => {
                    setMessageAction(props.chatId, message, MessageAction.EDIT);
                });
            };

            return {
                moment,
                toggleSendForwardMessage,
                replyMessage,
                user,
                deleteMessage,
                deleteReply,
                editMessage,
                MessageTypes,
                clock,
                selectedMessageId,
            };
        },
    });
</script>
<style lang="css" scoped></style>
