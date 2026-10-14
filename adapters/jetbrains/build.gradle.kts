plugins {
    java
    id("org.jetbrains.intellij.platform") version "2.9.0"
}
repositories { mavenCentral(); intellijPlatform { defaultRepositories() } }
dependencies { intellijPlatform { intellijIdeaCommunity("2025.2.1"); bundledPlugin("com.intellij.java") } }
java { toolchain { languageVersion.set(JavaLanguageVersion.of(21)) } }
intellijPlatform { pluginConfiguration { version = "0.1.0"; ideaVersion { sinceBuild = "252" } } }
