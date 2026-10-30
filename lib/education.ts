import type { HeartPartId } from "./heart-parts";

export const LEARNING_LEVELS = ["basic", "intermediate", "advanced"] as const;
export type LearningLevel = (typeof LEARNING_LEVELS)[number];
export const LEARNING_LEVEL_DESCRIPTIONS: Record<LearningLevel, string> = {
  basic: "For students with limited anatomical knowledge.",
  intermediate: "For university students in non-medical disciplines.",
  advanced: "For students studying healthcare or medicine, and clinical professionals.",
};
export const REFERENCES = {
  arteries: { title: "StatPearls: Heart Arteries", url: "https://www.ncbi.nlm.nih.gov/books/NBK470522/" },
  lad: { title: "StatPearls: Left Anterior Descending Artery", url: "https://www.ncbi.nlm.nih.gov/books/NBK482375/" },
  angiography: { title: "StatPearls: Coronary Arteriography", url: "https://www.ncbi.nlm.nih.gov/books/NBK538158/" },
  dominance: { title: "JAHA: Clinical Significance of Coronary Arterial Dominance", url: "https://pubmed.ncbi.nlm.nih.gov/38639360/" },
  inferior: { title: "StatPearls: Inferior Myocardial Infarction", url: "https://www.ncbi.nlm.nih.gov/books/NBK470572/" },
  revascularization: { title: "ACC/AHA/SCAI: Revascularization Guideline Perspectives", url: "https://www.acc.org/latest-in-cardiology/ten-points-to-remember/2021/12/08/21/19/2021-guideline-for-revascularization-gl-revasc" },
  circumflex: { title: "Cleveland Clinic: Circumflex Artery", url: "https://my.clevelandclinic.org/health/body/23926-circumflex-artery" },
  surgery: { title: "Review: Coronary Anatomy Relevant to Cardiac Surgery", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12060931/" },
  conus: { title: "Clinical Anatomy: The Conal Artery", url: "https://pubmed.ncbi.nlm.nih.gov/25255889/" },
  posterior: { title: "Clinical Case: Posterior MI and ECG Recognition", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7949675/" },
  aorta: { title: "StatPearls: Aortic Dissection", url: "https://www.ncbi.nlm.nih.gov/books/NBK441963/" },
  flow: { title: "Cleveland Clinic: Blood Flow Through the Heart", url: "https://my.clevelandclinic.org/health/body/17060-how-does-the-blood-flow-through-your-heart" },
  svc: { title: "StatPearls: Superior Vena Cava", url: "https://www.ncbi.nlm.nih.gov/books/NBK545255/" },
  sinus: { title: "StatPearls: Coronary Sinus", url: "https://www.ncbi.nlm.nih.gov/books/NBK557566/" },
} as const;
export type ReferenceId = keyof typeof REFERENCES;
export type EducationEntry = Record<LearningLevel, string> & { bloodFlow: string[]; references: ReferenceId[] };

/** Authored from the supplied document, with qualified territories and clinical context.
 * Segment boundaries vary between reporting conventions; positions are illustrative.
 * Content is independent of model meshes, anchors and marker numbering.
 */
export const EDUCATION: Record<HeartPartId, EducationEntry> = {
  "right-coronary-proximal": {
    basic: "This is the beginning of the artery serving much of the right side of the heart. It starts near the main artery leaving the heart and carries oxygen-rich blood to heart muscle.",
    intermediate: "The proximal RCA arises from the right aortic sinus and enters the right atrioventricular groove. Early branches include conus and, commonly, sinoatrial nodal branches. It conducts blood to downstream right ventricular and, depending on dominance, inferior ventricular territories; nodal origins vary.",
    advanced: "Occlusion before major right ventricular branches may cause right ventricular ischemia alongside an inferior infarction. Inferior ST elevation in II, III and aVF and right-sided ECG leads help assess this pattern, but do not prove a precise segment. Angiography establishes the lesion and branch anatomy.",
    bloodFlow: ["Right aortic sinus", "Proximal RCA", "RCA branches"], references: ["arteries", "angiography", "inferior"],
  },
  "right-coronary-middle": {
    basic: "The middle portion continues around the heart's right side. It carries blood onward and gives off branches that help feed the right-sided pumping chamber.",
    intermediate: "The middle RCA follows the right atrioventricular groove toward the acute margin. Right ventricular branches, including acute marginal branches, may arise along this course. Unlike the proximal segment, it is farther from the aortic origin, while remaining upstream of the distal posterior circulation.",
    advanced: "A mid-RCA stenosis can limit flow to branches beyond it while sparing branches arising earlier. The effect depends on branch origins, dominance and collateral flow. Coronary angiography uses multiple projections to separate vessel overlap and define the lesion before considering intervention.",
    bloodFlow: ["Proximal RCA", "Middle RCA", "Marginal branches and distal RCA"], references: ["angiography", "arteries", "dominance"],
  },
  "right-coronary-distal": {
    basic: "The final portion of this artery curves toward the back and underside of the heart. In many people, its branches feed muscle on the heart's lower surface.",
    intermediate: "The distal RCA approaches the crux, where the atrioventricular and posterior interventricular grooves meet. In a right-dominant pattern it gives rise to the PDA and often posterolateral branches. The AV nodal artery commonly arises near the crux; its parent vessel varies with anatomy.",
    advanced: "Distal RCA disease may compromise inferior or inferoseptal myocardium and sometimes AV nodal perfusion. Bradycardia or AV block can accompany inferior infarction, but are not inevitable. Angiography must identify the PDA, posterolateral branches and dominance rather than infer territory from the vessel name alone.",
    bloodFlow: ["Middle RCA", "Distal RCA", "PDA and posterolateral branches in right dominance"], references: ["arteries", "inferior", "dominance"],
  },
  "posterior-descending-artery": {
    basic: "This artery runs down the heart's back-facing groove toward its tip. It feeds nearby muscle and part of the wall between the pumping chambers. Its starting artery differs between people.",
    intermediate: "Also called the posterior interventricular artery, the PDA runs in the posterior interventricular sulcus and gives septal branches. It usually arises from the RCA, but may arise from the circumflex. Its origin is central to defining coronary dominance; codominance also involves shared inferior or posterior supply.",
    advanced: "PDA occlusion may cause inferior or inferoseptal ischemia. Angiography traces its origin to distinguish right from left dominance and assess the actual jeopardized territory. The supplied document's right-dominant description is an example, not a property established by this placeholder or a universal anatomical rule.",
    bloodFlow: ["RCA or LCx, depending on dominance", "PDA", "Inferior and posterior septal branches"], references: ["dominance", "angiography", "inferior"],
  },
  "left-coronary-artery": {
    basic: "This short artery begins near the main artery leaving the heart. It usually splits into two major routes that carry oxygen-rich blood to much of the left-sided pumping muscle.",
    intermediate: "Here, Left Coronary Artery denotes the left main trunk. It arises from the left aortic sinus and usually divides into the LAD and LCx between the pulmonary trunk and left atrial appendage. A ramus intermedius may form a third branch; trunk length varies.",
    advanced: "Significant left main stenosis can endanger both LAD and LCx territories. Angiography and, when appropriate, intravascular imaging clarify lesion severity. Revascularization decisions consider anatomy and patient factors; guidelines support bypass surgery and selected PCI strategies. A left main lesion is distinct from an isolated proximal LAD lesion.",
    bloodFlow: ["Left aortic sinus", "Left main", "LAD and LCx"], references: ["arteries", "surgery", "revascularization"],
  },
  "left-anterior-descending-proximal": {
    basic: "The beginning of this artery travels down the front of the heart. It carries blood to a large area of pumping muscle and sends small branches into the wall between the pumping chambers.",
    intermediate: "The proximal LAD continues from the left main into the anterior interventricular groove. Early septal perforators and diagonal branches supply the septum and anterolateral left ventricle. Proximal segment limits use branch landmarks in clinical reporting, but conventions differ; this marker is an approximate location.",
    advanced: "A proximal LAD occlusion may threaten extensive anterior and septal myocardium, depending on branch takeoffs and collateral supply. Anterior ECG changes support localization but are not a complete anatomical map. Angiography guides treatment; the LAD is an important bypass target, without assuming it is always the largest artery.",
    bloodFlow: ["Left main", "Proximal LAD", "Septal and diagonal branches; downstream LAD"], references: ["lad", "revascularization", "surgery"],
  },
  "left-anterior-descending-mid": {
    basic: "The middle part runs farther down the front groove of the heart. It feeds nearby muscle and carries blood toward the heart's tip.",
    intermediate: "The mid LAD lies between the proximal branch-rich region and the distal course toward the apex. Septal perforators and diagonal branches may arise here. Their number and origin vary, so a middle segment should be identified using the reporting convention and observed branch landmarks rather than fixed distances.",
    advanced: "Mid-LAD stenosis limits flow downstream while earlier branches may remain perfused. The ischemic burden depends on the lesion's relation to septal and diagonal branches. Angiography or coronary CT defines anatomy; assessment of functional significance can inform revascularization rather than segment naming alone.",
    bloodFlow: ["Proximal LAD", "Mid LAD", "Distal LAD and regional branches"], references: ["lad", "angiography", "revascularization"],
  },
  "left-anterior-descending-apical": {
    basic: "This is the artery's far end near the pointed tip of the heart. It brings oxygen-rich blood to muscle around that tip. Its final route varies between people.",
    intermediate: "The apical LAD is the distal course near the left ventricular apex. It may terminate there or wrap onto the inferior surface. This educational apical label is not a separate named artery or a universally defined angiographic segment; the distal supply depends on individual anatomy.",
    advanced: "Distal LAD occlusion may produce apical ischemia or infarction. A wraparound LAD can also involve inferior myocardium, complicating ECG localization. Imaging establishes its extent. Smaller distal caliber and the available viable territory influence procedural planning; a distal lesion should not be assigned a fixed clinical outcome.",
    bloodFlow: ["Mid LAD", "Apical LAD", "Apical myocardium; variable inferior extension"], references: ["lad", "surgery", "revascularization"],
  },
  "left-diagonal-d1": {
    basic: "D1 is the first diagonal branch along the artery on the front of the heart. It spreads outward across the left-sided pumping chamber and feeds nearby muscle.",
    intermediate: "D1 denotes the first diagonal branch of the LAD, numbered by origin from proximal to distal. It crosses the anterolateral left ventricular surface. Diagonals supply free-wall myocardium, unlike septal perforators entering the septum. Their size, number and supplied territory vary.",
    advanced: "D1 stenosis can cause anterolateral ischemia, with the affected mass depending on branch size and distribution. LAD-diagonal bifurcation disease requires attention to both vessels during PCI planning. D1 is an order label, not a guarantee that this branch is larger or clinically more important than D2.",
    bloodFlow: ["LAD", "D1", "Anterolateral left ventricular muscle"], references: ["lad", "arteries", "revascularization"],
  },
  "left-diagonal-d2": {
    basic: "D2 is the second diagonal branch along the artery on the front of the heart. It starts farther along than D1 and helps feed the outer front of the left-sided pumping chamber.",
    intermediate: "D2 arises distal to D1 along the LAD and courses over the anterolateral left ventricular free wall. It is distinguished by order of origin, not a fixed surface territory or diameter. Additional diagonals may exist, and some hearts do not have two substantial identifiable diagonal branches.",
    advanced: "D2 occlusion can cause regional ischemia, but consequences depend on its actual perfusion territory and other supply. Angiography distinguishes a diagonal lesion from disease in the continuing LAD. Bifurcation intervention may affect either vessel; numbering alone cannot predict infarct size or the need for a separate branch procedure.",
    bloodFlow: ["LAD distal to D1 origin", "D2", "Variable anterolateral territory"], references: ["lad", "angiography", "revascularization"],
  },
  "left-circumflex-artery": {
    basic: "This artery curves around the left side toward the back of the heart. Its branches bring oxygen-rich blood to much of the side and back of the left-sided pumping muscle.",
    intermediate: "The LCx usually arises from the left main and follows the left atrioventricular groove beneath the left atrial appendage. Obtuse marginal branches supply the lateral left ventricular wall. Its posterior extent varies; in left dominance it gives rise to the PDA, and nodal branches may also arise from it.",
    advanced: "LCx occlusion can cause lateral or posterior infarction; a dominant LCx may affect a wider inferior territory. Posterior ischemia can be missed on a standard ECG, so posterior leads V7–V9 may help when clinically indicated. Angiography establishes dominance and the lesion rather than relying on ECG territory alone.",
    bloodFlow: ["Left main", "LCx", "Obtuse marginal and variable posterior branches"], references: ["circumflex", "dominance", "posterior"],
  },
  "right-marginal-artery": {
    basic: "This branch runs near the heart's right-hand lower edge. It supplies oxygen-rich blood to muscle in the right-sided pumping chamber.",
    intermediate: "The right, or acute, marginal artery arises from the RCA and travels along the acute margin toward the apex. It supplies right ventricular free-wall myocardium. Multiple marginal branches can exist, and their origins and extent differ; it should not be confused with left-sided obtuse marginal branches.",
    advanced: "A lesion involving a substantial acute marginal branch may impair right ventricular perfusion. In RCA disease, identifying whether the occlusion lies before or after this branch helps explain right ventricular involvement. Angiographic assessment of branch anatomy is more informative than assuming every RCA lesion affects the right ventricle equally.",
    bloodFlow: ["RCA", "Acute marginal branch", "Right ventricular free wall"], references: ["arteries", "angiography", "inferior"],
  },
  "right-conus-artery": {
    basic: "This small artery feeds the upper part of the right-sided pumping chamber, near the route to the lungs. It often branches early from the right coronary artery, but may start separately.",
    intermediate: "The conus artery supplies the right ventricular infundibulum, or outflow tract. It may arise from the proximal RCA, a shared opening, or a separate opening in the right aortic sinus. It can communicate with left-sided conal branches; this is a variable collateral pathway.",
    advanced: "A separately originating conus artery may not appear during routine selective RCA injection. Recognizing its ostium and course matters in angiography and outflow-tract procedures. Conal connections can contribute collateral supply in coronary disease, but their presence does not guarantee adequate protection from ischemia.",
    bloodFlow: ["Proximal RCA or separate right sinus ostium", "Conus artery", "Right ventricular outflow tract"], references: ["conus", "arteries", "angiography"],
  },
  "left-marginal-artery": {
    basic: "This branch runs down the left edge of the heart. It brings oxygen-rich blood to muscle on the side of the main pumping chamber.",
    intermediate: "The left, or obtuse, marginal artery is usually a branch of the LCx, itself a branch of the left main. It descends over the obtuse margin and supplies lateral left ventricular myocardium. There may be several obtuse marginal branches, with variable size and territory.",
    advanced: "Obtuse marginal stenosis or occlusion may cause lateral-wall ischemia. A substantial marginal branch can be a bypass target or a PCI target, depending on the lesion and overall disease. Angiography distinguishes marginal branch disease from proximal LCx disease, which can jeopardize several downstream branches.",
    bloodFlow: ["Left main", "LCx", "Obtuse marginal branch", "Lateral left ventricle"], references: ["circumflex", "surgery", "revascularization"],
  },
  "ascending-aorta": {
    basic: "This is the first upward part of the body's main artery. It carries blood away from the left-sided pumping chamber. The arteries feeding the heart begin near its base.",
    intermediate: "The ascending aorta continues from the aortic root above the left ventricular outflow tract toward the aortic arch. The coronary ostia arise in the right and left aortic sinuses at the root. It is a systemic great artery, not a coronary artery, and conducts blood into systemic circulation.",
    advanced: "Ascending aortic aneurysm and type A dissection can threaten aortic valve function or coronary ostial perfusion. CT angiography and echocardiography help assess the aorta and associated complications. Coronary malperfusion in dissection has a different mechanism from coronary plaque stenosis and changes procedural priorities.",
    bloodFlow: ["Left ventricle", "Aortic valve and root", "Ascending aorta", "Aortic arch"], references: ["flow", "aorta"],
  },
  "superior-vena-cava": {
    basic: "This large vein returns oxygen-poor blood from the head, arms and upper body to the right side of the heart. It is not an artery feeding heart muscle.",
    intermediate: "The SVC forms from the right and left brachiocephalic veins, receives the azygos vein and descends in the right mediastinum into the superior right atrium. It returns upper-body systemic venous blood. It is a systemic vein, distinct from the coronary veins draining myocardium.",
    advanced: "Thrombosis or external compression can obstruct SVC return, producing upper-body venous congestion, facial swelling and collateral veins. Central venous devices are one possible cause. Persistent left SVC is an anatomical variant often draining into the coronary sinus; imaging is relevant before venous access and cardiac device procedures.",
    bloodFlow: ["Upper body", "Brachiocephalic veins and azygos contribution", "SVC", "Right atrium"], references: ["svc", "sinus"],
  },
  "coronary-sinus": {
    basic: "This large collecting vein sits at the back of the heart. It gathers much of the used blood from heart muscle and returns it to the right upper chamber.",
    intermediate: "The coronary sinus lies in the posterior atrioventricular groove between the left atrium and ventricle and opens into the right atrium. Tributaries include the great, middle and small cardiac veins. It drains much, but not all, myocardial venous blood; other cardiac veins can drain directly into chambers.",
    advanced: "Coronary sinus anatomy matters for left ventricular lead placement in cardiac resynchronization and for retrograde cardioplegia. Variable tributaries or valves can complicate access. A dilated sinus may suggest persistent left SVC or elevated right atrial pressure; it is a clue requiring assessment, not a diagnosis by itself.",
    bloodFlow: ["Myocardial capillaries", "Cardiac venous tributaries", "Coronary sinus", "Right atrium"], references: ["sinus", "svc"],
  },
};
