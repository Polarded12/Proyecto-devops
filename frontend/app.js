// --- 1. BASE DE DATOS ---
// Ahora la base de datos inicial la obtiene del backend mediante un endpoint REST.
let database = [];

async function loadInitialDatabase() {
    try {
        const resp = await fetch('/api/articles');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        database.push(...data);
    } catch (err) {
        console.error('Error cargando la base de datos inicial desde el servidor:', err);
    }
}

// --- 1.5 LECTURA E INTEGRACIÓN DE PDFs ---

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Lista de tus archivos PDF en la carpeta
const pdfFilesToLoad = [
    { id: "pdf-cpeum", sourceName: "CPEUM (Federal)", stateCode: "federal", url: "./CPEUM.pdf", tags: ["constitucion", "federal"] },
    { id: "pdf-cuu", sourceName: "Chihuahua", stateCode: "cuu", url: "./cuu.pdf", tags: ["estatal", "chihuahua"] },
    { id: "pdf-gua", sourceName: "Guanajuato", stateCode: "gua", url: "./gua.pdf", tags: ["estatal", "guanajuato"] },
    { id: "pdf-hid", sourceName: "Hidalgo", stateCode: "hid", url: "./HID.pdf", tags: ["estatal", "hidalgo"] },
    { id: "pdf-cdmx", sourceName: "Ciudad de México", stateCode: "cdmx", url: "./CDMX.pdf", tags: ["estatal", "capital"] }
];

// Función para extraer texto completo de un PDF
async function extractTextFromPDF(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + " \n"; // Agregamos un salto de línea por página por si acaso
        }
        return fullText;
    } catch (error) {
        console.error(`Error cargando el PDF ${url}:`, error);
        return "";
    }
}

// NUEVA FUNCIÓN: Cortar el texto gigante en artículos individuales
function splitIntoArticles(fullText, fileInfo) {
    // Esta expresión regular busca la palabra "Artículo" (o ARTÍCULO) seguida de un número.
    // El (?=...) asegura que cortemos el texto justo ANTES de la palabra "Artículo", para no borrarla.
    const regex = /(?=\bART[IÍ]CULO\s+\d+)/gi;
    
    // Cortamos el texto gigante
    const parts = fullText.split(regex);
    
    const articlesArray = [];
    let counter = 1;

    parts.forEach(part => {
        const textContent = part.trim();
        
        // Descartamos pedazos muy pequeños (como el índice, la portada o páginas en blanco)
        if (textContent.length < 50) return;

        // Intentamos extraer el nombre exacto del artículo para el título (ej. "ARTÍCULO 1o.")
        const titleMatch = textContent.match(/^(ART[IÍ]CULO\s+\d+[a-z°\.]*)/i);
        
        // Si encuentra el patrón, usa ese título. Si no (por ejemplo en un preámbulo largo), usa un título genérico.
        const title = titleMatch ? titleMatch[1].toUpperCase() : `Sección General - Fragmento ${counter}`;
        
        articlesArray.push({
            id: `${fileInfo.id}-art-${counter}`,
            sourceName: fileInfo.sourceName,
            stateCode: fileInfo.stateCode,
            title: title,
            content: textContent,
            tags: fileInfo.tags // Hereda las etiquetas del archivo principal
        });
        
        counter++;
    });

    return articlesArray;
}

// Función para cargar todos los PDFs y separarlos
async function loadAllPdfs() {
    const container = document.getElementById('articlesList');
    if(container) {
        container.innerHTML = `
            <div class="text-center py-20 bg-white rounded-xl border border-slate-100 shadow-sm">
                <i data-lucide="book-open" class="h-10 w-10 mx-auto text-amber-500 mb-4 animate-bounce"></i>
                <p class="text-lg font-bold text-slate-800 mb-2">Procesando Leyes y Constituciones...</p>
                <p class="text-sm text-slate-500">Separando los artículos uno por uno. Esto puede tardar unos segundos.</p>
            </div>
        `;
        lucide.createIcons();
    }

    for (const file of pdfFilesToLoad) {
        const text = await extractTextFromPDF(file.url);
        
        if (text) {
            // Pasamos el texto extraído por nuestra "guillotina" de artículos
            const separatedArticles = splitIntoArticles(text, file);
            
            // Añadimos todos los artículos resultantes a la base de datos global
            database.push(...separatedArticles);
        }
    }
    
    // Una vez procesados todos los archivos, mostramos los resultados
    performSearch();
}

// --- 2. Funciones Auxiliares ---
const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// --- 3. Motor de Búsqueda y Renderizado ---
function performSearch() {
    const rawQuery = document.getElementById('searchInput').value.trim();
    const query = normalize(rawQuery);
    const filterState = document.getElementById('filterState').value;
    const filterScope = document.getElementById('filterScope').value;
    const container = document.getElementById('articlesList');
    const activeFiltersDiv = document.getElementById('activeFilters');

    if (!rawQuery) {
        activeFiltersDiv.innerHTML = 'Mostrando todo';
    } else {
        activeFiltersDiv.innerHTML = `
            <span class="inline-block bg-slate-100 px-2 py-1 rounded text-xs mr-1 mb-1 font-semibold">🔍 Filtro: "${rawQuery}"</span>
            ${filterScope !== 'all' ? `<span class="inline-block bg-amber-50 text-amber-800 px-2 py-1 rounded text-xs mr-1 mb-1">Ámbito: ${filterScope}</span>` : ''}
            ${filterState !== 'all' ? `<span class="inline-block bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1">Estado: ${filterState.toUpperCase()}</span>` : ''}
        `;
    }

    let results = database.filter(item => {
        const textMatch = !query || 
            normalize(item.content).includes(query) ||
            normalize(item.title).includes(query) ||
            item.tags.some(tag => normalize(tag).includes(query));
        
        const stateMatch = filterState === 'all' || item.stateCode === filterState;
        const scopeMatch = filterScope === 'all' || 
            (filterScope === 'federal' && item.stateCode === 'federal') ||
            (filterScope === 'local' && item.stateCode !== 'federal');

        return textMatch && stateMatch && scopeMatch;
    });

    renderResults(results, container, rawQuery);
}

function renderResults(results, container, rawQuery) {
    container.innerHTML = '';
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-xl text-center shadow-sm border border-slate-200">
                <i data-lucide="search-x" class="h-10 w-10 mx-auto text-slate-300 mb-4"></i>
                <h3 class="text-lg font-medium text-slate-900">No se encontraron artículos</h3>
                <p class="text-slate-500 mt-2 text-sm">Intenta ajustar tu búsqueda o los filtros.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const header = document.createElement('div');
    header.className = "flex justify-between items-end pb-4 border-b border-slate-100 mb-4";
    header.innerHTML = `
        <div>
            <span class="text-2xl font-bold text-slate-900">${results.length}</span>
            <span class="text-sm text-slate-500 ml-1">artículos disponibles</span>
        </div>
    `;
    container.appendChild(header);

    // Limitamos la renderización a los primeros 100 resultados para no colgar el navegador
    const resultsToRender = results.slice(0, 100);

    resultsToRender.forEach(item => {
        let badgeClass = "bg-slate-100 text-slate-600";
        if (item.stateCode === 'federal') badgeClass = "badge-federal";
        if (item.stateCode === 'cuu') badgeClass = "badge-cuu";
        if (item.stateCode === 'gua') badgeClass = "badge-gua";
        if (item.stateCode === 'hid') badgeClass = "badge-hid";
        if (item.stateCode === 'cdmx') badgeClass = "badge-cdmx";

        let displayContent = item.content;
        let displayTitle = item.title;

        if (rawQuery) {
            const regex = new RegExp(`(${rawQuery})`, 'gi');
            displayContent = item.content.replace(regex, '<span class="search-highlight">$1</span>');
            displayTitle = item.title.replace(regex, '<span class="search-highlight">$1</span>');
        }

        const card = document.createElement('div');
        card.className = "bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group hover:border-amber-200 mb-4";
        card.onclick = () => openModal(item.id);
        
        const tagsHtml = item.tags.map(tag => 
            `<span class="px-2 py-1 bg-slate-50 text-slate-500 rounded text-[10px] uppercase font-bold border border-slate-200 tracking-wider hover:bg-slate-100 transition">${tag}</span>`
        ).join('');

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${badgeClass}">${item.sourceName}</span>
                </div>
                <i data-lucide="external-link" class="text-slate-300 group-hover:text-amber-500 h-4 w-4 transition-transform"></i>
            </div>
            <h4 class="text-lg font-bold text-slate-800 group-hover:text-amber-700 transition mb-2">${displayTitle}</h4>
            <p class="text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed">${displayContent}</p>
            <div class="flex gap-2 flex-wrap mt-auto">
                ${tagsHtml}
            </div>
        `;
        container.appendChild(card);
    });

    if (results.length > 100) {
        const warning = document.createElement('div');
        warning.className = "text-center text-sm text-slate-500 py-4";
        warning.textContent = `Mostrando los primeros 100 resultados de ${results.length}. Por favor, sé más específico en tu búsqueda.`;
        container.appendChild(warning);
    }

    lucide.createIcons();
}

// --- 4. Modal ---
function openModal(id) {
    const article = database.find(a => a.id === id);
    if (!article) return;

    document.getElementById('modalTitle').textContent = article.title;
    const badge = document.getElementById('modalSourceBadge');
    badge.textContent = article.sourceName;
    
    badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ";
    if (article.stateCode === 'federal') badge.classList.add('bg-slate-800', 'text-white');
    else if (article.stateCode === 'cuu') badge.classList.add('bg-purple-100', 'text-purple-800');
    else if (article.stateCode === 'gua') badge.classList.add('bg-blue-100', 'text-blue-800');
    else if (article.stateCode === 'hid') badge.classList.add('bg-green-100', 'text-green-800');
    else if (article.stateCode === 'cdmx') badge.classList.add('bg-pink-100', 'text-pink-800');

    document.getElementById('modalContent').textContent = article.content;
    document.getElementById('articleModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('articleModal').classList.add('hidden');
}

// INICIALIZACIÓN
window.onload = async function() {
    // primero pedimos los datos al backend
    await loadInitialDatabase();

    // luego procesamos los PDFs como antes
    await loadAllPdfs(); 
    lucide.createIcons();
};