import { MessageChannelMain, MessagePortMain, ipcMain } from "electron"
import { MessagePortRendererInbox } from "./communicators/message-port-renderer-inbox"
import { MessagePortMainInbox } from "./communicators/message-port-main-inbox"

interface MainMessageChannel {
    inbox: MessagePortMainInbox,
    port: MessagePortMain
}

interface RendererMessageChannel {
    inbox: MessagePortRendererInbox,
    port: MessagePort
}

export type MessageChannelConstructor = () => MainMessageChannel | RendererMessageChannel;

export function getMessageChannelConstructor(): MessageChannelConstructor {
    return function() {
        if (ipcMain) {
            const channel = new MessageChannelMain();
    
            const resultChannel: MainMessageChannel = {
                inbox: new MessagePortMainInbox(channel.port1),
                port: channel.port2
            }
    
            return resultChannel;
        }
    
        const channel = new MessageChannel();
    
        const resultChannel: RendererMessageChannel = {
            inbox: new MessagePortRendererInbox(channel.port1),
            port: channel.port2
        }
    
        return resultChannel;
    }
}