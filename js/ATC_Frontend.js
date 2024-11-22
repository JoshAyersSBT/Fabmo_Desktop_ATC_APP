var fabmo = new FabMoDashboard();
let bitOptions = [];
let atc;

// ATC Tool Changer Subcomponent
class ATCToolChanger {
    constructor(toolSlots) {
        this.toolSlots = toolSlots;
        this.currentTool = null;
        this.tools = Array(toolSlots).fill({ type: "No tool", size: "Medium", h: null });
        this.offBarTools = []; // Off Bar Tools storage
    }

    loadTools(toolData) {
        toolData.forEach((tool, i) => {
            if (i < this.toolSlots) {
                this.tools[i] = {
                    type: tool?.type || "No tool",
                    size: tool?.size || "No Size Saved",
                    h: tool?.h || null
                };
            } else {
                this.offBarTools.push({
                    type: tool?.type || "No tool",
                    size: tool?.size || "No Size Saved",
                    h: tool?.h || null
                });
            }
        });

        // Fill empty slots if `toolData` has fewer tools
        for (let i = toolData.length; i < this.toolSlots; i++) {
            this.tools[i] = { type: "No tool", size: "Medium", h: null }; // Default for unused slots
        }
    }

    changeTool(targetSlot) {
        if (targetSlot >= 0 && targetSlot < this.toolSlots) {
            console.log(`Changing from Tool ${this.currentTool} to Tool ${targetSlot}`);
            fabmo.runSBP(`&Tool=${targetSlot+1}\nC71\n`);
            if (this.tools[targetSlot].h === undefined) {
                fabmo.runSBP('\nC72\n');
                this.tools[targetSlot].h = fabmo.requestStatus('posz');
            }
            this.currentTool = targetSlot;
        } else {
            console.error("Invalid tool slot selected.");
        }
    }

    getCurrentTool() {
        if (this.currentTool === null || !this.tools[this.currentTool]) {
            return "No tool is currently loaded.";
        }
        const tool = this.tools[this.currentTool];
        return `Current Tool: Slot ${this.currentTool + 1} - ${tool.type} (${tool.size}) Bit Length: ${tool.h || "Unknown"}`;
    }
}

// Fetch bit information and load configuration
fetch('bit_information.json')
    .then(response => response.json())
    .then(data => {
        bitOptions = data.bitTypes || ["No tool"];
        loadATCConfiguration();
    })
    .catch(error => {
        console.error('Error fetching bit information:', error);
    });

// Function to fetch ATC configuration from opensbp.json and initialize the tool changer
function loadATCConfiguration() {
    fabmo.getConfig((err, data) => {
        if (err) {
            console.error("Error loading configuration:", err);
            return;
        }

        const toolSlots = Number(data.opensbp.variables.ATC.NUMCLIPS);
        atc = new ATCToolChanger(toolSlots);

        // Load tools from configuration
        const toolData = Object.values(data.opensbp.variables.TOOLS || {});
        atc.loadTools(toolData);

        atc.currentTool = (data.opensbp.variables.ATC.TOOLIN || 1) - 1;

        // Display tools and current tool
        displayToolList();
        displayOffBarTools();
        displayCurrentTool();
    });
}

// Display the current tool
function displayCurrentTool() {
    document.getElementById("current-tool").textContent = atc.getCurrentTool();
}

// Display the list of ATC Tools
function displayToolList() {
    const toolListOutput = document.getElementById("tool-list-output");
    if (!toolListOutput) {
        console.error('Tool List container not found.');
        return;
    }
    toolListOutput.innerHTML = '';
    atc.tools.forEach((tool, index) => {
        if (tool) {
            const toolRow = createToolRow(tool, index, false);
            toolListOutput.appendChild(toolRow);
        } else {
            console.warn(`Tool slot ${index + 1} is undefined.`);
        }
    });
}

// Display the Off Bar Tools
function displayOffBarTools() {
    const offBarToolsOutput = document.getElementById("off-bar-tools-output");
    if (!offBarToolsOutput) {
        console.error('Off-Bar Tools container not found.');
        return;
    }
    offBarToolsOutput.innerHTML = '';
    atc.offBarTools.forEach((tool, index) => {
        if (tool) {
            const toolRow = createToolRow(tool, index, true);
            offBarToolsOutput.appendChild(toolRow);
        } else {
            console.warn(`Off-Bar Tool slot ${index + 1} is undefined.`);
        }
    });
}

// Helper function to create tool row
function createToolRow(tool, index, isOffBar = false) {
    const toolRow = document.createElement("div");
    toolRow.className = "tool-row";

    // Tool Change Button
    const toolButton = document.createElement("button");
    toolButton.className = "tool-slot-button";
    toolButton.textContent = `${isOffBar ? 'Off-Bar Tool' : 'Slot'} ${isOffBar ? atc.toolSlots + index + 1 : index + 1}`;
    toolButton.addEventListener('click', () => {
        if (isOffBar) {
            changeOffBarTool(index);
        } else {
            atc.changeTool(index);
            displayCurrentTool();
        }
    });

    // Tool Select Dropdown
    const toolSelect = document.createElement("select");
    toolSelect.className = "tool-select";
    toolSelect.innerHTML = bitOptions.map(option =>
        `<option value="${option}" ${tool.type === option ? 'selected' : ''}>${option}</option>`
    ).join('');
    toolSelect.addEventListener('change', (event) => updateToolAttribute(index, 'type', event.target.value, isOffBar));

    // Tool Size Input
    const toolInput = document.createElement("input");
    toolInput.type = "text";
    toolInput.className = "tool-size-input";
    toolInput.value = tool.size || "No Size Saved";
    toolInput.addEventListener('change', (event) => updateToolAttribute(index, 'size', event.target.value, isOffBar));

    // Measure Tool Button
    const measureToolButton = document.createElement("button");
    measureToolButton.className = "measure-tool-button";
    measureToolButton.textContent = "Measure Tool";
    measureToolButton.addEventListener('click', () => {
        fabmo.runSBP(`\n&tool=${index + 1}\nC72\n`);
        console.log(`Measuring Tool in ${isOffBar ? 'Off-Bar' : 'Slot'} ${index + 1}`);
    });

    toolRow.append(toolButton, toolSelect, toolInput, measureToolButton);
    return toolRow;
}

// Update a tool attribute for ATC Tools
function updateToolAttribute(slotIndex, attribute, newValue, isOffBar = false) {
    const toolList = isOffBar ? atc.offBarTools : atc.tools;
    toolList[slotIndex][attribute] = newValue;
    updateCurrentToolInConfig(atc.currentTool);
}

// Change Off Bar Tool
function changeOffBarTool(slotIndex) {
    if (atc && slotIndex >= 0 && slotIndex < atc.offBarTools.length) {
        console.log(`Changing to Off Bar Tool ${slotIndex + atc.toolSlots + 1}`);
    } else {
        alert("Invalid tool slot number. Please select a valid off-bar tool.");
    }
}

// Update the current tool in the configuration
function updateCurrentToolInConfig(currentTool) {
    fetch('config/opensbp.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ATC: { NUMCLIPS: atc.toolSlots, TOOLIN: currentTool + 1, STATUS: atc.currentTool ? "OK" : "NOT ATTACHED" },
            TOOLS: Object.assign({}, ...[...atc.tools, ...atc.offBarTools].map((tool, i) => ({ [i]: tool })))
        })
    })
    .then(response => response.ok ? console.log('Configuration updated successfully') : Promise.reject('Error updating configuration'))
    .catch(error => console.error('Error updating configuration:', error));
}

// Event listeners for control buttons
document.addEventListener("DOMContentLoaded", () => {
    // Button functionality
    const buttonActions = {
        "C2-Zero": () => fabmo.runSBP('C2'),
        "C3-Home": () => fabmo.runSBP('C3'),
        "C72-Measure-all-Tools": () => fabmo.runSBP('C72'),
        "C73-Get-plate-offset": () => fabmo.runSBP('C73'),
        "C74-Calibrate": () => fabmo.runSBP('C74')
    };

    Object.entries(buttonActions).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) button.addEventListener("click", action);
    });

    // Settings pane functionality
    const settingsButton = document.getElementById("settings-button");
    const settingsPane = document.getElementById("settings-pane");
    const backdrop = document.getElementById("backdrop");
    const closeSettingsButton = document.getElementById("close-settings-button");

    settingsButton.addEventListener("click", () => {
        settingsPane.classList.toggle("show");
        settingsPane.classList.toggle("hidden");
        backdrop.classList.toggle("show");
    });

    closeSettingsButton.addEventListener("click", () => {
        settingsPane.classList.add("hidden");
        settingsPane.classList.remove("show");
        backdrop.classList.remove("show");
    });

    backdrop.addEventListener("click", () => {
        settingsPane.classList.add("hidden");
        settingsPane.classList.remove("show");
        backdrop.classList.remove("show");
    });
});
