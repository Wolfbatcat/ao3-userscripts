# AO3: Reading Time & Quality Score

Get a quick feel for any fic at a glance:
- **Reading Time Bar** ⏱️ – see how long it’ll take to read.
  - **NEW** - View chapter reading times at the start of works!
- **Quality Score Bar** ⭐ – a smarter kudos/hits ratio that accounts for fic length.
- **Both features are independent** — use one or both

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-5.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-9.png "Reading Time & Quality Score Bar")


The full set of icons comes from [Rose Pine site skin](https://archiveofourown.org/works/69993411) or [Stat Icons with Hover Text](https://archiveofourown.org/works/55604875/chapters/141130912), though you can still enable the reading time and score icons through this script.

---

### ✨ Features

#### **Reading Time**
- Estimates reading time based on word count.  
- Fully customizable reading speed (**WPM setting**) so it matches your pace.  
- Color thresholds highlight short, medium, and long reads at a glance.  

![Reading Time](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-1.png "Reading Time Settings")

##### **NEW** - Chapter Reading Time & Word Count
- Provides reading time and word count at the start of the chapter
- Three different visual options (Default, Notice, and Time Only

![Chapter Reading Time](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-10.png "Chapter Reading Time Settings")


#### **Quality Score**
- Uses **kudos + hits + word count** to calculate engagement.  
- **Formula:** kudos per hit, adjusted by √(words ÷ 5000).  
- Word-based scoring avoids:  
  - Punishing long fics just for being long.  
  - Rewarding fics split into tiny chapters.  
- **Normalization (optional):**  
  - Converts raw scores into a 0–100 scale.  
  - You choose the **“max score”** baseline (default: 32).  
  - **Best practice:** set max score to the **highest raw score in your fandom** — that fic will be treated as “perfect.”  
  - Want more forgiving scores? Just set the max score lower.  
- Configurable thresholds color-code scores (e.g., low, medium, high).  
- **Hide works by score:** Optionally filter out works below a minimum quality score threshold.

![Quality Score](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-2.png "Quality Score Settings")

### **Highly Customizable**
- Hide work metrics on blurbs (kudos, hits, bookmarks, and comments)
- Three different visual options (Default, Colored, and Bar)
- Optional icons to go with [Rose Pine site skin](https://archiveofourown.org/works/69993411) or [Stat Icons with Hover Text](https://archiveofourown.org/works/55604875/chapters/141130912)

![Visual Options](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-3.png)

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-5.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-9.png "Reading Time & Quality Score Bar")


![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-6.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-7.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_reading-time-quality-score-8.png "Reading Time & Quality Score Bar")

---

### ⚙️ How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209)

1. Install with a userscript manager:  
   - **Tampermonkey**
     - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)  
     - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)  
     - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)  
     - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)   
3. Click **Userscripts** → **Reading Time & Quality Score** to open settings.
4. **Save** your changes for them to go into effect.

---

### 🙌 Credits
- [cupkax’s improved Quality Score script](https://greasyfork.org/en/scripts/482730-ao3-quality-score-adjusted-kudos-hits-ratio)  
- [lomky’s Estimated Reading Time v2](https://greasyfork.org/en/scripts/418872-ao3-estimated-reading-time-v2)  

---

### 📜 Check out my other scripts:
- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942-ao3-advanced-blocker) - Block works on AO3 based on tags, authors, titles, word counts, language, completion status, and much more. 
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537-ao3-site-wizard) - Customize fonts and sizes across the entire site, adjust work reader margins, fix spacing issues, and configure text alignment preferences.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820-ao3-skin-switcher) - Change skins from anywhere on AO3.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571-ao3-chapter-shortcuts) - Add a customizable shortcut to the latest chapter of works.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623-ao3-no-re-kudos) - Hide kudos button if you've already left kudos.