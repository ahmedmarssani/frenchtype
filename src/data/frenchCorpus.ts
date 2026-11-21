import type {CustomText, WordSource} from '../types';

const RAW_COMMON_WORDS =
  'le la les un une des de du et est à dans pour que qui ne pas ce il elle nous vous ils sur avec son sont mais comme tout plus faire dire pouvoir aller vouloir savoir falloir venir prendre donner trouver porter mettre passer jour temps homme femme enfant main chose monde vie année maison ville eau fois matin soir semaine mois être avoir voir où déjà très après été école père mère frère élève problème système qualité usine défaut peinture pièce surface vérifier contrôle température humidité épaisseur couche vernis apprendre comprendre français écrire lire parler travail équipe réunion machine production même aussi alors depuis pendant toujours jamais beaucoup peu trop encore souvent parfois ensemble différent important possible nécessaire difficile facile rapide lentement sécurité propre sale plastique couleur brillant mat rugueux lisse rayure bulle coulure poussière nettoyage séchage cabine four pistolet pression débit viscosité mélange durcisseur solvant réparer vérification résultat contrôler améliorer réduire éviter répondre demander écouter regarder arriver commencer terminer première deuxième dernier prochain hôpital café marché bientôt hier demain aujourd’hui ça là ici chez entre sans sous vers contre selon malgré parce que quand lorsque pourquoi comment combien quel quelle ceux celle leur notre votre leurs mes tes ses';

const RAW_DARIJA_ENTRIES =
  'le:el (article masculin)|la:el (article féminin)|les:el (article pluriel)|un:wa7ed|une:wa7da|des:article pluriel, ma yetterjemch|de:men / mte3|du:mte3 el|et:w|est:howa / hiya (verbe être)|à:l / fi|dans:fi|pour:bech / 3ala jal|que:elli / ki|qui:elli / chkoun|ne:négation : ne … pas|pas:ma … ch (négation)|ce:hedha|il:houwa|elle:hiya|nous:e7na|vous:intouma|ils:houma|sur:3la|avec:m3a|son:mte3ou / mte3ha|sont:homa (verbe être)|mais:lakin|comme:kima|tout:koll|plus:akther|faire:ya3mel|dire:yeqoul|pouvoir:yenjem|aller:yemchi|vouloir:yheb|savoir:ya3ref|falloir:lezem|venir:yji|prendre:ya5ou|donner:ya3ti|trouver:yelqa|porter:ye7mel|mettre:y7ot|passer:yfout|jour:nhar|temps:wa9t / jaw|homme:rajel|femme:mra|enfant:tefl|main:yed|chose:chay|monde:3alem / ness|vie:7aya|année:3am|maison:dar|ville:mdina|eau:ma|fois:mara|matin:sbe7|soir:3chiya|semaine:jom3a (7 ayyem)|mois:chahar|être:ykoun|avoir:yamlek|voir:ychouf|où:win|déjà:men9bal / dé7a|très:barcha|après:ba3d|été:koun (passé de être) / sif|école:madrasa|père:bou / baba|mère:omm / mama|frère:5ou|élève:tilmidh|problème:mochkla|système:nidham|qualité:jawda|usine:masna3|défaut:3ayb|peinture:sibagha / bouya|pièce:9it3a|surface:sath|vérifier:yet2akkad|contrôle:mourakba|température:daraja mte3 el 7rara|humidité:roTouba|épaisseur:sama9a|couche:tabqa|vernis:vernis / talé|apprendre:yet3allem|comprendre:yefhem|français:faransawi|écrire:yekteb|lire:yeqra|parler:yahki|travail:khedma|équipe:fari9|réunion:ijtima3|machine:makina|production:intaj|même:nafs / 3ayn|aussi:zeda|alors:yaw / ya3ni|depuis:men|pendant:wa9t / khilél|toujours:dima|jamais:abadan / 3omri|beaucoup:barcha|peu:chwaya|trop:barcha zeyed|encore:zeda / mazel|souvent:barcha marrat|parfois:marrat|ensemble:m3a b3adhna|différent:mokhtalef|important:mouhim|possible:momken|nécessaire:dharouri|difficile:s3ib|facile:sahl|rapide:sari3|lentement:bchwaya|sécurité:amen / salama|propre:nDhif|sale:wsekh|plastique:plastik|couleur:lawn|brillant:lami3|mat:mat (bla lam3a)|rugueux:khchin|lisse:amlas|rayure:kharcha|bulle:fa9a3a|coulure:sayl (el peinture yenzel)|poussière:ghobra|nettoyage:tandhif|séchage:tajfif|cabine:kabina|four:forn|pistolet:pistolé (msaddas)|pression:dhaght|débit:tadaffoq / debit|viscosité:lozouja|mélange:khalta|durcisseur:mousalleb (durcisseur)|solvant:moudhib (diluant)|réparer:yesla7|vérification:ta2kid|résultat:natija|contrôler:yraqeb|améliorer:ye7assen|réduire:yna9es|éviter:yetjannab|répondre:yjaweb|demander:yes2el / yTlob|écouter:yesma3|regarder:yetfarraj / ychouf|arriver:youSal|commencer:yebda|terminer:yekhles|première:lowla|deuxième:ethenya|dernier:e5er|prochain:jey|hôpital:sbitar|café:9ahwa|marché:souq|bientôt:9rib|hier:el bare7|demain:ghodwa|aujourd’hui:lyoum|ça:hedha|là:hna / hnéka|ici:hna|chez:3and|entre:bin|sans:bla|sous:ta7t|vers:lil / nahw|contre:dhed|selon:7asb|malgré:raghm|parce:5ater (parce que)|quand:waqtech / waqt|lorsque:waqt elli|pourquoi:3lech|comment:kifech|combien:9addech|quel:ayyé (masculin)|quelle:ayyé (féminin)|ceux:elli (houma)|celle:elli (hiya)|leur:mte3hom|notre:mte3na|votre:mte3kom|leurs:mte3hom|mes:mte3i|tes:mte3ek|ses:mte3ou|manger:yekel|boire:yochrob|dormir:yarqed|marcher:yetmacha|courir:yjri|ouvrir:yeftah|fermer:ysakker|acheter:yechri|vendre:yebi3|payer:yekhlass|chercher:ydawwer|attendre:yestanna|changer:y8ayyer|choisir:yekhtar|couper:y9ass|casser:yekssar|tomber:yteh|monter:yetla3 / yrakkeb|descendre:yenzel|entrer:yodkhol|sortir:yekhrej|rester:yeb9a|partir:yetla9 / yemchi|revenir:yarja3|appeler:y3ayet / ynadi|aider:y3awen|utiliser:yesta3mel|essayer:yjarreb|oublier:yensa|penser:yfakker|croire:ysaddeq|montrer:yewerri|expliquer:yfassar|préparer:y7addher|nettoyer:ynadhdhef|peindre:ysabbegh / ybouyi|sécher:yjaffef|mesurer:yqiss|compter:y7seb|noter:yseggel|ranger:yrattib|remplir:ymalli|vider:yfarregh|serrer:yechedd|tourner:yedour|tirer:yjbed|pousser:yedfa3|lever:yrafa3|baisser:yhabbet|arrêter:y7abbes|continuer:ykammel|réussir:yenja7|échouer:yfachel|gagner:yerbah|perdre:yokhsar|risquer:yghamer|jouer:yel3ab|aimer:ye7eb|détester:yekrah|habiter:yskon|vivre:y3ich|rire:yedh7ak|pleurer:yebki|chanter:yghanni|danser:yre9es|entendre:ysma3|sentir:yechem|toucher:ylemes|rencontrer:yetla9a|inviter:y3azzem|accepter:ye9bel|refuser:yrefedh|permettre:yseme7|interdire:ymna3|cacher:ykhabbi|chauffer:ysakhkhen|refroidir:ybarred|verser:ysob|mélanger:ykhalet|appliquer:ytabbeq|pulvériser:yrouch|frotter:yfrek|gratter:yjrad|polir:ylam3|durcir:yeslab|coller:ylassaq|décoller:ynezza3|démonter:yfekk|assembler:yrakkeb|installer:ynaseb|régler:yDabbet|analyser:y7allel|comparer:yqaren|enregistrer:ysajjel|envoyer:yab3ath|recevoir:yjih|télécharger:y7ammel|imprimer:ytba3|copier:yenssakh|supprimer:ymsa7|sauvegarder:ya7fedh|ouvrier:3amel|chef:chef / mas2oul|responsable:mas2oul|client:client / 7arif|fournisseur:mouzawwed|commande:commande / talab|livraison:tasleem|stock:stock / makhzoun|magasin:magasin|atelier:warcha|ligne:khatt|poste:poste el khedma|outil:ada|mesure:qiyes|norme:mi3yar|procédure:ijra2|instruction:ta3lima|document:wathiqa|rapport:taqrir|tableau:jadwel|liste:qaima|plan:plan / mokhatat|photo:soura|échantillon:3ayyena|lot:lot / dof3a|série:silsila|taux:nesba|objectif:hadaf|cause:sabab|solution:7all|action:3amal|erreur:ghalta|panne:3otl|arrêt:wa9fa|retard:ta2khir|coût:kolfa|prix:thaman|budget:mizaniya|contrat:3a9d|salaire:mahia|congé:ijaza|horaire:jadwel el 3mel|heure:sa3a|minute:da9i9a|seconde:thenya|apprêt:primaire (tabqa lowla)|laque:laque (talé)|métallisation:tghtiya bel ma3dan|masquage:ghatya bel scotch|ponçage:tan3im bel papier|dégraissage:ta2zil el dohn|flammage:7arq sat7i|plasma:plasma|adhérence:iltisaq|cloque:fa9a3a (cloque)|cratère:7ofra sghira fil peinture|pigment:pigment / sabgha|teinte:darajet el lawn|brillance:lam3an|microns:micron|jauge:jauge|retouche:retouche / tasli7|rebut:rebut / mardoud|conforme:motabeq|tolérance:tasamo7|spécification:mouwasafat|matière:madda|résine:resine|injection:7a9n|moule:qalib|support:da3em|convoyeur:tapis nagel|accrochage:ta3liq|crochet:crochet|filtre:filtre|air:hwé|ventilation:tahwiya|aspiration:chafd|gant:gant|masque:masque|lunettes:nadhdharat|casque:casque|chaussures:sabbat|blouse:blouse|attention:intibeh|danger:khatar|interdit:mamnou3|obligatoire:ijbari|pain:khobz|lait:7lib|sucre:sokkar|sel:mel7|thé:atey|poisson:7out|viande:la7m|poulet:djej|légumes:khodhra|fruit:fakiha|pomme:tof7a|tomate:tomatem|oeuf:bidha|fromage:jben|riz:rouz|pâtes:makarouna|huile:zit|couscous:keskes|repas:wejba|déjeuner:ghda|dîner:3acha|faim:jou3|soif:3atch|chaud:skhoun|froid:bared|grand:kbir|petit:sghir|long:twil|court:9sir|large:3rid|étroit:dhayeq|haut:3ali|bas:wati|lourd:thqil|léger:khfif|vide:fared|plein:ma3mer|nouveau:jdid|vieux:9dim|jeune:chab|bon:behi|mauvais:mouch behi|meilleur:a7sen|joli:7elou|beau:jmil|laid:bchi3|cher:ghali|gratuit:balach|riche:ghani|pauvre:fa9ir|content:farhan|triste:7zin|fatigué:t3eb|malade:mridh|fort:9awi|faible:dha3if|vrai:s7i7 / 7a9i9i|faux:ghalet|juste:s7i7 / 3adel|clair:wadhe7|calme:hadi|lundi:itnin|mardi:thletha (nhar)|mercredi:arb3a (nhar)|jeudi:khemis|vendredi:jom3a|samedi:sebt|dimanche:a7ad|nuit:lil|maintenant:tawa|avant:9bal|tard:mta2khar|tôt:bekri|vite:bsor3a|lent:bati2|famille:3ayla|fils:weld|fille:bent|oncle:3amm / khal|tante:khalti / 3amti|ami:sa7bi|voisin:jar|collègue:zmil|patron:patron|docteur:tbib|médecin:tbib|voiture:karhba|bus:bus|train:train|avion:tayara|route:tari9|rue:zenqa|gare:mo7atta|billet:tiket|argent:flous (money) / fidhdha|banque:banka|téléphone:telefoun|ordinateur:ordinateur|clavier:lawhat el mafatih|écran:ecran|souris:far / souris|fichier:malaf|internet:internet|message:resala|mail:email|lettre:resala / 7arf|page:safha|livre:ktab|cahier:kourras|stylo:9alam|papier:wara9|table:tawla|chaise:korsi|porte:beb|fenêtre:chebbek|chambre:ghorfa|cuisine:kouzina|salle:qa3a|bureau:maktab|jardin:jnena|mer:bahr|plage:plage|montagne:jbel|soleil:chams|pluie:chta|vent:rih|nuage:ghayma|ciel:sma|lune:9mar|étoile:njem|arbre:chajra|fleur:warda|animal:7ayawen|chat:9attous|chien:kalb|oiseau:asfour|voyage:safra|vacances:ijaza|hôtel:hotel|passeport:jawaz safar|valise:chanta|visite:ziara|pays:blad|tunisie:Tounes|france:faransa|zéro:sifr|deux:zouz|trois:thletha|quatre:arb3a|cinq:khamsa|six:setta|sept:sab3a|huit:thmenya|neuf:tes3a|dix:3achra|vingt:3ichrin|cent:mia|mille:alf|rouge:a7mar|bleu:azra9|vert:akhdhar|jaune:asfar|noir:ek7al|blanc:abyadh|gris:rmédi|rose:wardi|marron:9ahwi|tête:ras|pied:rejl|oeil:3ayn|oreille:widhn|bouche:fam|nez:khachm|dos:dhahr|coeur:9alb|santé:sa7a|douleur:waja3|médicament:dawa|pharmacie:saydaliya|ou:wala|donc:ya3ni|car:5ater|si:ken|puis:ba3d|ensuite:ba3d hakka|seulement:bark|presque:taqriban|environ:7awali|chaque:koll|autre:akher|autres:akherin|quelque:chwaya|personne:wa7ed|rien:hata chay|tous:koll el nes|bien:behi|mal:ghalet / mouch behi|mieux:a7sen|moins:a9all|assez:kefaya|vraiment:7a9i9a|oui:iyeh|non:la|merci:3aychek|bonjour:3aslema / sba7 el khir|bonsoir:msa el khir|salut:3aslema|désolé:asef|pardon:sma7ni|bienvenue:marhbe|bravo:bravo|question:souel|réponse:jaweb|exemple:mithél|mot:kelma|phrase:jomla|langue:logha|accent:accent / nabra|grammaire:qawa3ed|texte:nass|idée:fikra|sens:ma3na|exercice:tamrin|leçon:dars|test:ikhtibar|note:3alama|niveau:mostawa|progrès:ta9addom|faute:ghalta / khata2|correct:s7i7|apprentissage:ta3allom|mémoire:dhakira';

const RAW_THEMES = [
  'Qualité§audit:mourajaa (taftich el système)|inspection:taftich|anomalie:khalal / anomalie|écart:far9 / inhiraf|dérive:inhiraf tadrijy|réclamation:chakwa mel client|traçabilité:tatabbo3 (min win jet el pièce)|indicateur:mou2achir|amélioration:ta7sin|capabilité:qodra (capabilité el procédé)|étalonnage:dhabt el appareil|gabarit:gabarit (qyes)|rejet:rafdh|tri:fartha / tri|blocage:7ajz (el pièces)|isolement:3azl|dérogation:isti3tha2 (dérogation)|certification:chhada|exigence:talab / chart|critère:mi3yar / chart|défectueux:ma3youb|acceptable:maqboul|rejeté:marfoudh|tendance:ittijéh|défaut|conforme|tolérance|contrôle|contrôler|vérification|vérifier|rebut|retouche|norme|mesure|qualité|cause|solution|rayure|bulle|poussière|coulure|cloque|cratère|erreur|résultat|taux|échantillon',
  'Méthodes et production§gamme:gamme (marsouma mraa7el el khedma)|nomenclature:liste mta3 el pièces|chronométrage:9ias el wa9t|cycle:cycle / dawra|rendement:mardoudiya|productivité:intajiya|ergonomie:ra7et el 3amel|standardisation:tawhid / standard|optimisation:ta7sin / optimisation|gaspillage:israf / gaspillage|flux:tadaffoq / flux|goulot:nuqtet el ikhtinaq|cadence:cadence / wtira|capacité:qodra|paramètres:mou3attayat / paramètres|recette:paramètres mta3 el produit|fiche:waraqa / fiche|balancement:tawazon el khatt|implantation:tawzi3 el machines|changement:tghyir|performance:ada2|disponibilité:jahiziya|réglage:dhabt|production|ligne|poste|machine|temps|atelier|stock|outil|plan|procédure|instruction|document|norme|mesure|pièce|objectif',
  'Peinture et surface§primaire:tabqa lowla (primaire)|base:tabqa el lawn (base)|polymérisation:tajaffof kimya2i|cuisson:tabkh / cuisson|étuve:forn mte3 tasskhin|projection:rach|électrostatique:kahrabaiya sakina|robot:robot|buse:far9et el rach (buse)|tamis:ghirbel|viscosimètre:jihaz qiyes lozouja|dilution:tamdid|dépoussiérage:ta2zil el ghobra|soufflette:nafakha hawa2iya|surépaisseur:sama9a zeyda|manque:na9s|nuance:darajet lawn|spectrophotomètre:jihaz qiyes el lawn|brillancemètre:jihaz qiyes el lam3an|quadrillage:test el iltisaq (quadrillage)|arrachement:ta9la3|inclusion:7aja gharība dakhel el peinture|fibre:khayt (fibre)|silicone:silicone|contamination:talawoth|dégazage:khrouj el ghaz|ruissellement:sayl|apprêt|vernis|couche|laque|métallisation|masquage|ponçage|dégraissage|flammage|plasma|adhérence|pigment|teinte|brillance|microns|cabine|four|pistolet|pression|débit|viscosité|mélange|durcisseur|solvant|séchage|nettoyage|surface|plastique|couleur|brillant|mat|rugueux|lisse|pulvériser|appliquer|polir|frotter|gratter|coller|décoller|résine|injection|moule|matière|crochet|convoyeur|accrochage|filtre|air|jauge|épaisseur|peinture',
  'Maintenance§maintenance:siyana|préventive:wiqa2iya|corrective:i3lajiya|dépannage:tasli7 sari3|graissage:tadh7im / graissage|lubrifiant:mouzayyit|roulement:roulement|courroie:7izem (courroie)|vérin:vérin (piston)|capteur:capteur / mostach3er|automate:automate (API)|moteur:moteur|pompe:pompe|vanne:vanne|joint:joint|fuite:tasarrob|usure:talaf / ihtiraa2|vibration:ihtizaz|redémarrage:i3adet el tachghil|câble:cable|électrique:kahrabai|mécanique:mikaniki|pneumatique:hawai2i|hydraulique:hydraulique|alarme:inthar / alarme|panne|arrêt|retard|machine|outil|réparer|démonter|assembler|installer|régler|nettoyer|serrer|huile',
  'Sécurité et environnement§accident:7adeth|incident:7adith sghir|risque:khatar / risque|prévention:wiqaya|extincteur:tafayet / extincteur|évacuation:ikhla2|secours:is3af|formation:ta3lim / formation|habilitation:tarkhis (habilitation)|consigne:ta3lima / consigne|signalisation:isharat|toxique:sam|inflammable:sari3 el ichti3al|déchets:nofayet|recyclage:i3adet tadwir|bruit:dhawdha|protection:7imaya|blessure:jarh|brûlure:7arq|incendie:7ari9|alerte:inthar|urgence:isti3jel|sécurité|danger|attention|interdit|obligatoire|gant|masque|lunettes|casque|chaussures|blouse|ventilation|aspiration|propre|sale',
  'Management et réunions§ordre:tartib|agenda:jadwel a3mel|décision:qarar|priorité:awlawiya|délai:mouhla|échéance:maw3ed nihai|avancement:taqaddom|planning:planning|suivi:moutaba3a|validation:mousadaqa|approbation:moujafaqa|proposition:iqtirah|présentation:3ardh|synthèse:molakhkhas|bilan:7sab / bilan|responsabilité:mas2ouliya|collaboration:ta3awon|communication:ittisal|retour:retour (feedback)|demande:talab|ressource:mawred|effectif:3adad el 3omel|absent:ghayeb|présent:7adher|remplaçant:badil|superviseur:moucharref|direction:idara|directeur:modir|manager:manager|hiérarchie:soulta / hiérarchie|escalade:tas3id (escalade)|réunion|équipe|chef|responsable|travail|objectif|résultat|problème|solution|plan|rapport|tableau|liste|document|photo',
  'Emails et administratif§cordialement:ma3 tahiyati|veuillez:min fadhlek|destinataire:el moustalem|expéditeur:el morsel|objet:el 3onwan / objet|joint:morfaq|confirmer:y2akked|informer:yokhbir|transmettre:yballegh|solliciter:yTlob|rappel:tadhkir|accusé:accusé (ta2kid)|réception:istilem|attente:intidher|dossier:malaf|devis:3ardh thaman (devis)|facture:facture|signature:imdha2|signer:yamdhi|valider:ysaddaq|approuver:yowafe9|disponible:mawjoud|bonjour|bonsoir|merci|désolé|pardon|bienvenue|message|mail|lettre|page|fichier|document|envoyer|recevoir|copier|enregistrer|imprimer|télécharger|question|réponse',
  'Logistique§approvisionnement:tamwin|expédition:ichhen / expédition|palette:palette|chariot:3rabiya (chariot)|emballage:ta3bi2a|étiquette:bitaqa (étiquette)|code:code / ramz|inventaire:jard|rupture:inqita3 (rupture de stock)|transport:na9l|camion:camion|quai:rassif (quai)|colis:colis|entrepôt:makhzen kbir|fabrication:tasn3|lancement:tawjih / lancement|quantité:kammiya|stock|magasin|commande|livraison|fournisseur|client|lot|série',
  'Carrière et RH§entretien:mouqabala|candidat:moutaraches|embauche:tawdhif|compétence:kifaya / compétence|expérience:khibra|promotion:tarqiya|démission:istiqala|stage:stage / tadrib|diplôme:chahada (diplôme)|ingénieur:mouhandes|technicien:technicien / fanni|opérateur:3amel / opérateur|cadre:cadre / itar|gestionnaire:modir|motivation:dafi3|salaire|congé|contrat|horaire|poste|travail|équipe|apprentissage|niveau|progrès|objectif',
  'Mesures et technique§vitesse:sor3a|force:qowwa|poids:wazn|volume:7ajm|longueur:tol|largeur:3ardh|hauteur:irtifa3|diamètre:qotr|angle:zawiya|dimension:ib3ad|unité:wa7da|mètre:mitr|litre:litr|kilogramme:kilo|degré:daraja|pourcentage:nesba mi2awiya|moyenne:moutawassit|maximum:a9sa|minimum:adna|valeur:qima|chiffre:raqm|graphique:rasm bayani|température|pression|humidité|débit|épaisseur|microns|mesurer|compter|mesure|jauge|taux|tableau',
  'Vie quotidienne§maison|ville|eau|jour|matin|soir|semaine|mois|argent|banque|voiture|rue|porte|table|chaise|cuisine|chambre|bureau|jardin|téléphone|ordinateur|famille|ami|voisin|enfant|fils|fille',
  'Nourriture§pain|lait|sucre|sel|thé|café|poisson|viande|poulet|légumes|fruit|pomme|tomate|oeuf|fromage|riz|pâtes|huile|couscous|repas|déjeuner|dîner|faim|soif|manger|boire|chaud|froid',
  'Santé§tête|main|pied|oeil|oreille|bouche|nez|dos|coeur|santé|douleur|médicament|pharmacie|hôpital|docteur|médecin|malade|fatigué|fort|faible',
  'Voyage§voyage|vacances|hôtel|passeport|valise|visite|pays|tunisie|france|avion|train|bus|gare|billet|route|plage|montagne|mer|soleil|pluie|vent|partir|revenir|arriver',
  'Temps et nombres§lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|nuit|maintenant|avant|tard|tôt|vite|lent|zéro|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|cent|mille|rouge|bleu|vert|jaune|noir|blanc|gris|rose|marron',
  'Verbes essentiels§faire|dire|pouvoir|aller|vouloir|savoir|venir|prendre|donner|trouver|porter|mettre|passer|manger|boire|dormir|marcher|courir|ouvrir|fermer|acheter|vendre|payer|chercher|attendre|changer|choisir|couper|casser|tomber|monter|descendre|entrer|sortir|rester|appeler|aider|utiliser|essayer|oublier|penser|montrer|expliquer|préparer|continuer|arrêter',
  'Langue et études§mot|phrase|langue|accent|grammaire|texte|idée|sens|exercice|leçon|test|note|niveau|progrès|faute|correct|apprentissage|mémoire|question|réponse|exemple|apprendre|comprendre|écrire|lire|parler|français|école|élève|livre|cahier|stylo|papier',
];

export const DICTIONARY: Record<string, string> = {};
RAW_DARIJA_ENTRIES.split('|').forEach((item) => {
  const idx = item.indexOf(':');
  if (idx > 0) {
    DICTIONARY[item.slice(0, idx)] = item.slice(idx + 1);
  }
});

export const THEMES_VOCAB: Record<string, string[]> = {
  'Tout le vocabulaire pro': [],
};

RAW_THEMES.forEach((row) => {
  const sepIdx = row.indexOf('§');
  const name = row.slice(0, sepIdx);
  const words = row
    .slice(sepIdx + 1)
    .split('|')
    .map((x) => {
      const j = x.indexOf(':');
      if (j > 0) {
        const w = x.slice(0, j);
        DICTIONARY[w] = x.slice(j + 1);
        return w;
      }
      return x;
    })
    .filter((k) => Boolean(DICTIONARY[k]));
  THEMES_VOCAB[name] = words;
});

const PRO_THEMES = [
  'Qualité',
  'Méthodes et production',
  'Peinture et surface',
  'Maintenance',
  'Sécurité et environnement',
  'Management et réunions',
  'Emails et administratif',
  'Logistique',
  'Carrière et RH',
  'Mesures et technique',
];

THEMES_VOCAB['Tout le vocabulaire pro'] = Array.from(
  new Set(PRO_THEMES.flatMap((n) => THEMES_VOCAB[n] ?? []))
);

export const COMMON_WORDS: string[] = Array.from(
  new Set([...RAW_COMMON_WORDS.split(' '), ...Object.keys(DICTIONARY)])
);

export const THEME_NAMES = Object.keys(THEMES_VOCAB);

export const AI_THEMES = [
  'peinture industrielle',
  'usine et qualité',
  'méthodes et production',
  'quotidien',
  'voyage',
  'santé',
  'technologie',
];

export interface DictationItem {
  id: string;
  category: string;
  fr: string;
  darija: string;
}

export const DICTATION_PHRASES: DictationItem[] = [
  {
    id: 'p1',
    category: 'Peinture & surface',
    fr: 'Le contrôle d’épaisseur du vernis indique quarante microns sur la pièce plastique.',
    darija: 'Mouraqbet sama9et el vernis twerri 40 micron 3la el 9it3a el plastik.',
  },
  {
    id: 'p2',
    category: 'Peinture & surface',
    fr: 'Il faut vérifier la viscosité de l’apprêt avant la pulvérisation en cabine.',
    darija: 'Lezem net2akdou men lozoujet el primaire 9bal ma nrochou fil kabina.',
  },
  {
    id: 'p3',
    category: 'Peinture & surface',
    fr: 'Le dégraissage et le flammage améliorent l’adhérence de la peinture sur le support.',
    darija: 'Ta2zil el dohn wel 7arq sat7i y7assnou iltisaq el bouya 3la el 9it3a.',
  },
  {
    id: 'p4',
    category: 'Peinture & surface',
    fr: 'Nous avons détecté une coulure et deux poussières après la cuisson à l’étuve.',
    darija: 'Lqina sayl w zouz ghobra ba3d el tabkh fil forn.',
  },
  {
    id: 'q1',
    category: 'Qualité',
    fr: 'La traçabilité du lot permet d’isoler rapidement les pièces non conformes.',
    darija: 'Tatabbo3 el lot ykhellina n3azlou fisa3 el 9ita3 elli mouch motabqa.',
  },
  {
    id: 'q2',
    category: 'Qualité',
    fr: 'Le test de quadrillage vérifie l’adhérence de la couche de laque après séchage.',
    darija: 'Test el quadrillage y2akked iltisaq el laque ba3d ma tcheh.',
  },
  {
    id: 'q3',
    category: 'Qualité',
    fr: 'Le taux de rebut a diminué grâce au réglage précis de la pression du pistolet.',
    darija: 'Nesbet el mardoud na9set b fadhl dhabt dhaght el pistolé.',
  },
  {
    id: 'm1',
    category: 'Méthodes & maintenance',
    fr: 'La gamme de fabrication précise la température, le débit et le temps de cycle.',
    darija: 'El gamme t7added darajet el 7rara, el debit w wa9t el cycle.',
  },
  {
    id: 'm2',
    category: 'Méthodes & maintenance',
    fr: 'La maintenance préventive nettoie les buses et remplace les filtres de ventilation.',
    darija: 'El siyana el wiqa2iya tnadhef el buses w tbaddel filtraouet el tahwiya.',
  },
  {
    id: 's1',
    category: 'Sécurité & réunion',
    fr: 'Le port du masque et des lunettes est obligatoire dans la zone de mélange solvant.',
    darija: 'Lebs el mask wel nadhdharat ijbari fi blaset khalt el moudhib.',
  },
  {
    id: 's2',
    category: 'Sécurité & réunion',
    fr: 'Veuillez confirmer la disponibilité de l’échantillon avant la réunion de demain.',
    darija: 'Min fadhlek akkedli mawjoudiyet el 3ayyena 9bal ijtima3 ghodwa.',
  },
];

export const DEFAULT_CUSTOM_TEXTS: CustomText[] = [
  {
    id: 'txt-gamme',
    title: 'Procédure cabine peinture',
    content:
      'Avant de démarrer la ligne, vérifiez la pression d’air, la propreté des crochets et la viscosité du mélange apprêt durcisseur. Contrôlez l’épaisseur en microns et la brillance sur le premier échantillon.',
    createdAt: 1700000000000,
  },
  {
    id: 'txt-rapport',
    title: 'Compte rendu qualité',
    content:
      'Aujourd’hui nous avons analysé un écart de teinte au spectrophotomètre et deux rayures sur la surface plastique. La retouche est validée après ponçage léger et séchage en étuve.',
    createdAt: 1700000001000,
  },
];

export function cleanWord(token: string): string {
  return token
    .toLowerCase()
    .replace(/[.,;:!?«»"'()]/g, '')
    .trim();
}

export function lookupDarija(
  rawWord: string,
  customWords: Record<string, string> = {},
  cachedTranslations: Record<string, string> = {}
): string | null {
  const k = cleanWord(rawWord);
  return customWords[k] || DICTIONARY[k] || cachedTranslations[k] || null;
}

export function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function buildWordSequence(
  source: WordSource,
  count: number,
  includePunctuation: boolean,
  options: {
    themeName: string;
    missedCounts: Record<string, number>;
    customTextContent?: string;
    aiWords?: string[];
  }
): string[] {
  if (source === 'ia' && options.aiWords && options.aiWords.length > 0) {
    return options.aiWords.slice(0, count);
  }

  if (source === 'textes' && options.customTextContent) {
    const tokens = options.customTextContent
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    if (tokens.length > 0) {
      if (tokens.length >= count) return tokens.slice(0, count);
      const repeated: string[] = [];
      while (repeated.length < count) {
        repeated.push(...tokens);
      }
      return repeated.slice(0, count);
    }
  }

  let pool: string[] = COMMON_WORDS;
  if (source === 'theme') {
    pool = THEMES_VOCAB[options.themeName] || COMMON_WORDS;
  } else if (source === 'erreurs') {
    const weighted: string[] = [];
    Object.entries(options.missedCounts).forEach(([w, c]) => {
      for (let i = 0; i < Math.min(3, c); i++) {
        weighted.push(w);
      }
    });
    if (weighted.length > 0) pool = weighted;
  }

  const out: string[] = [];
  let cap = true;
  let prev = '';
  for (let i = 0; i < count; i++) {
    let w = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && w === prev) {
      w = pool[(pool.indexOf(w) + 1) % pool.length];
    }
    prev = w;

    if (includePunctuation && w.length > 0) {
      if (cap) {
        w = w[0].toUpperCase() + w.slice(1);
        cap = false;
      }
      if (i === count - 1 || Math.random() < 0.12) {
        w += '.';
        cap = true;
      } else if (Math.random() < 0.1) {
        w += ',';
      }
    }
    out.push(w);
  }
  return out;
}

export const FRENCH_ACCENT_KEYS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'œ', '’'];
