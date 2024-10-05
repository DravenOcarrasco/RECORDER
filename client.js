(async function () {
    /**
     * Function to create a module context with WebSocket, storage, and custom data capabilities.
     * This function returns a context object with methods that allow interaction with WebSocket events, 
     * storage, and custom data management.
     *
     * @param {string} moduleName - The name of the module.
     * @returns {{
    *   MODULE_NAME: string,
    *   SOCKET: object,
    *   KEYBOARD_COMMANDS: Array<object>,
    *   setStorage: (key: string, value: any, isGlobal: boolean) => Promise<object>,
    *   getStorage: (key: string, isGlobal: boolean) => Promise<object>,
    *   getVariable: (variableName: string, defaultValue: any, create: boolean, isGlobal: boolean) => Promise<any>,
    *   showMenu: (options: Array<object>) => void,
    *   getCustomData: (key: string) => any,
    *   setCustomData: (key: string, value: any) => void
    *   setMenuHandler: (handlerFunction: function) => void
    * }} - The context object with methods for WebSocket, storage, and custom data.
   */
    function createContext(moduleName) {
        return window.WSACTION.createModuleContext(moduleName);
    }

    // Criar o contexto para o módulo utilizando a função createModuleContext
    const CONTEXT = createContext("RECORDER");
    const SOCKET = CONTEXT.SOCKET;
    CONTEXT
    CONTEXT.KEYBOARD_COMMANDS = [
        {
            description: "INIT/STOP RECORD",
            keys: [
                {
                    key: "control",
                    upercase: false
                },
                {
                    key: "alt",
                    upercase: false
                },
                {
                    key: "r",
                    upercase: false
                },
            ],
        }
    ]

    const startRecording = async () => {
        const result = await CONTEXT.setStorage('isRecording', true);
        if (result.success) {
            console.log('Recording started');
            if (!document.title.startsWith('🔴 Recording - ')) {
                document.title = '🔴 Recording - ' + document.title;
            }
        } else {
            console.error('Failed to start recording:', result.error);
        }
    };

    const stopRecording = async () => {
        const result = await CONTEXT.setStorage('isRecording', false);
        if (result.success) {
            console.log('Recording stopped');
            document.title = document.title.replace('🔴 Recording - ', '');
            const { value: recordingTitle } = await Swal.fire({
                title: 'Enter recording title',
                input: 'text',
                inputLabel: 'Recording title',
                inputPlaceholder: 'Enter the name for this recording',
                showCancelButton: true
            });

            if (recordingTitle) {
                SOCKET.emit(`${CONTEXT.MODULE_NAME}.make:script`, {
                    name: recordingTitle,
                    history: await CONTEXT.getVariable("record_temp", {})
                });
                await CONTEXT.setStorage("record_temp", {});
            } else {
                console.log('Recording title input was cancelled');
            }
        } else {
            console.error('Failed to stop recording:', result.error);
        }
    };

    const toggleRecording = async () => {
        const isRecording = await CONTEXT.getVariable('isRecording', false);
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    };

    const applyRecordingIconIfRecording = async () => {
        const isRecording = await CONTEXT.getVariable('isRecording', false);
        if (isRecording && !document.title.startsWith('🔴 Recording - ')) {
            document.title = '🔴 Recording - ' + document.title;
        }
    };

    SOCKET.on('connect', () => {
        console.log('Connected to WebSocket server');

        SOCKET.on(`${CONTEXT.MODULE_NAME}:event`, (data) => {
            console.log('Received event:', data);
        });
    });

    SOCKET.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });

    document.addEventListener('keydown', async (event) => {
        if (event.ctrlKey && event.altKey && event.code === 'KeyR') {
            console.log('Control + Alt + R pressed');
            await toggleRecording();
        }
    });

    await applyRecordingIconIfRecording();  // Check and apply recording icon on load

    // Função para obter o XPath de um elemento
    function getElementXPath(element) {
        const paths = [];
        for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
            let index = 0;
            for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName === element.nodeName) ++index;
            }
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = index ? `[${index + 1}]` : '';
            paths.unshift(`${tagName}${pathIndex}`);
        }
        return paths.length ? `/${paths.join('/')}` : null;
    }

    async function captureAction(event) {
        if (await CONTEXT.getVariable('isRecording', false)) {
            const element = event.target;
            const tagName = element.tagName;
            const action = event.type;
            const value = element.value;
            const selector = getElementXPath(element);
            let data = {
                tagName,
                action,
                value: value || null,
                selector,
                location: window.location.href,
                timestamp: new Date().toISOString(),
                additionalInfo: {}
            };

            // Adiciona informações adicionais dependendo do tipo de evento
            if (action === 'scroll') {
                data.additionalInfo = {
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                };
            } else if (action === 'keydown' || action === 'keyup' || action === 'keypress') {
                data.additionalInfo = {
                    key: event.key,
                    code: event.code,
                    keyCode: event.keyCode
                };
            } else if (action === 'click' || action === 'dblclick' || action === 'mousedown' || action === 'mouseup') {
                data.additionalInfo = {
                    button: event.button,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    screenX: event.screenX,
                    screenY: event.screenY
                };
            }

            console.log(data);
            let last = await CONTEXT.getVariable("record_temp", {});
            last[data.timestamp] = data;
            await CONTEXT.setStorage("record_temp", last);
        }
    }

    // Lista de eventos a serem capturados
    const eventsToCapture = [
        'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
        'keydown', 'keyup', 'keypress', 'input', 'change', 'scroll'
    ];

    // Captura todos os eventos listados
    eventsToCapture.forEach(eventType => {
        document.addEventListener(eventType, captureAction, true);
    });

    const context = await MakeContext()
    // Registro da extensão no contexto global
    if (window.extensionContext) {
        window.extensionContext.addExtension(context.MODULE_NAME, {
            location: window.location,
            ...context
        });
    }
})();
